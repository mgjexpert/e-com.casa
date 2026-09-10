// ============================================================
// E-com.casa — Refund abstraction (§41)
// ------------------------------------------------------------
// Server-side only. There is deliberately NO client-facing refund
// route: refunds are issued by internal tooling / support with an
// authorised session. The provider call, persistence and order
// transition happen in one flow with idempotency.
// ============================================================

import 'server-only';
import { db } from '@/lib/db';
import { getPaymentProvider } from './xpayments-provider';
import { toMinorUnit, fromMinorUnit } from './amounts';
import { PaymentError } from './payment-errors';

export interface RefundResult {
  refundId: string;
  status: string;
  amount: string;
  currency: string;
  orderPaymentStatus: string;
}

/**
 * Refund an order's payment, fully or partially.
 * @param orderId internal order id (cuid)
 * @param amountMajor optional partial amount in major units ("12.50"); omit for full refund
 * @param reason free-text reason stored for the audit trail
 */
export async function refundPayment(
  orderId: string,
  amountMajor?: string,
  reason?: string,
): Promise<RefundResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw new PaymentError('PAYMENT_ORDER_NOT_FOUND', 404);
  const payment = order.payments[0];
  if (!payment || order.paymentStatus !== 'PAID') {
    throw new PaymentError('PAYMENT_FAILED', 409, 'not_refundable');
  }

  const provider = getPaymentProvider();
  const fullAmountMinor = payment.amountMinor ?? toMinorUnit(order.total, order.currency);
  const amountMinor = amountMajor ? toMinorUnit(amountMajor, order.currency) : fullAmountMinor;
  if (amountMinor <= 0 || amountMinor > fullAmountMinor) {
    throw new PaymentError('PAYMENT_FAILED', 400, 'invalid_refund_amount');
  }

  const result = await provider.refundPayment(payment.paymentIntentId, amountMinor, reason);

  const status = result.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING';
  const refunded = (amountMinor === fullAmountMinor && status === 'SUCCEEDED') ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  await db.$transaction([
    db.refund.create({
      data: {
        paymentId: payment.id,
        refundId: result.refundId,
        amount: fromMinorUnit(amountMinor, order.currency),
        currency: order.currency,
        reason: reason ?? null,
        status,
      },
    }),
    db.payment.update({
      where: { id: payment.id },
      data: { status: refunded },
    }),
    db.order.update({
      where: { id: order.id },
      data: { paymentStatus: refunded },
    }),
    // credit note record (§42) — fiscal issuance adapter-ready
    db.creditNote.create({
      data: {
        orderId: order.id,
        refundId: result.refundId,
        number: `CN-${result.refundId.slice(-10).toUpperCase()}`,
        amount: fromMinorUnit(amountMinor, order.currency),
        currency: order.currency,
        reason: reason ?? null,
        status: 'ISSUED',
      },
    }),
  ]);

  return {
    refundId: result.refundId,
    status,
    amount: fromMinorUnit(amountMinor, order.currency),
    currency: order.currency,
    orderPaymentStatus: refunded,
  };
}
