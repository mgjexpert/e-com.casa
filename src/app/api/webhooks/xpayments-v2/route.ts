// Production XPayments merchant webhook contract.
// XPayments signs the RAW JSON body with HMAC-SHA256 and sends
// the lowercase hexadecimal digest in x-nexflowx-signature.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { getPaymentConfig } from '@/lib/payments/payments-config';
import { assignTrackingFields } from '@/lib/tracking';
import { sendPaymentConfirmedEmail } from '@/lib/email/order-email';

export const dynamic = 'force-dynamic';

interface XPaymentsEvent {
  event?: string;
  transaction_id?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  timestamp?: string;
}

function verify(rawBody: string, signature: string | null, secret: string | null): boolean {
  if (!signature || !secret || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const supplied = Buffer.from(signature.trim(), 'hex');
  const calculated = Buffer.from(expected, 'hex');
  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}

function idFor(event: XPaymentsEvent): string {
  return [event.transaction_id ?? 'unknown', event.event ?? 'unknown', event.timestamp ?? ''].join(':');
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const cfg = getPaymentConfig();
  if (!verify(rawBody, req.headers.get('x-nexflowx-signature'), cfg.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: XPaymentsEvent;
  try { event = JSON.parse(rawBody) as XPaymentsEvent; }
  catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }); }

  const transactionId = String(event.transaction_id ?? '');
  const eventType = String(event.event ?? '');
  if (!transactionId || !eventType) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });

  const eventId = idFor(event);
  try {
    await db.webhookEvent.create({ data: { id: eventId, provider: 'xpayments_stripe', type: eventType, payloadJson: rawBody.slice(0, 20_000) } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // providerAccount stores the XPayments transaction id. This is the
    // authoritative correlation key from the merchant webhook contract.
    const payment = await db.payment.findFirst({ where: { providerAccount: transactionId }, include: { order: true } });
    if (!payment) return NextResponse.json({ received: true, unknownTransaction: true });

    const order = payment.order;
    const status = String(event.status ?? '').toLowerCase();
    const method = String(event.method ?? payment.paymentMethodType ?? 'other');

    if (eventType === 'payment_intent.succeeded' || status === 'succeeded') {
      if (order.paymentStatus === 'PAID') return NextResponse.json({ received: true, noop: true });
      const paidAt = event.timestamp ? new Date(event.timestamp) : new Date();
      const effectivePaidAt = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;
      const tracking = assignTrackingFields(order.orderNumber, order.shippingMethod, order.country, effectivePaidAt);

      await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', paidAt: effectivePaidAt, lastEventId: eventId, paymentMethodType: method, failureCode: null, failureMessage: null } });
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', paidAt: effectivePaidAt, status: 'CONFIRMED', paymentMethodType: method, paymentFailureReason: null, trackingNumber: tracking.trackingNumber, carrier: tracking.carrier, originWarehouse: tracking.originWarehouse, estimatedDeliveryAt: tracking.estimatedDeliveryAt } });

        if (!order.stockApplied) {
          const items = JSON.parse(order.itemsJson) as Array<{ slug: string; quantity: number }>;
          for (const item of items) await tx.product.updateMany({ where: { slug: item.slug, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          await tx.order.update({ where: { id: order.id }, data: { stockApplied: true } });
        }

        const invoice = await tx.invoice.findUnique({ where: { orderId: order.id } });
        if (!invoice) await tx.invoice.create({ data: { orderId: order.id, invoiceNumber: `INV-${order.orderNumber.replace('EC-', '')}`, country: order.country, currency: order.currency, subtotal: order.subtotal, shipping: order.shipping, tax: order.tax, discount: order.discount, total: order.total, status: 'ISSUED' } });
      });

      await sendPaymentConfirmedEmail({ orderNumber: order.orderNumber, customerEmail: order.email, firstName: order.firstName, total: order.total, currency: order.currency, trackingNumber: tracking.trackingNumber, originWarehouse: tracking.originWarehouse });
      return NextResponse.json({ received: true });
    }

    if (eventType === 'payment_intent.payment_failed' || status === 'failed') {
      if (order.paymentStatus !== 'PAID') await db.$transaction([
        db.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failedAt: new Date(), lastEventId: eventId, paymentMethodType: method, failureCode: 'payment_failed' } }),
        db.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAYMENT_FAILED', paymentFailureReason: 'payment_failed' } }),
      ]);
      return NextResponse.json({ received: true });
    }

    if (eventType === 'payment_intent.processing' || status === 'processing') {
      if (order.paymentStatus !== 'PAID') await db.$transaction([
        db.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING', lastEventId: eventId, paymentMethodType: method } }),
        db.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAYMENT_PROCESSING' } }),
      ]);
      return NextResponse.json({ received: true });
    }

    if (eventType === 'payment_intent.canceled' || status === 'canceled' || status === 'cancelled') {
      if (!['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) await db.$transaction([
        db.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED', lastEventId: eventId, paymentMethodType: method } }),
        db.order.update({ where: { id: order.id }, data: { paymentStatus: 'CANCELLED', status: 'CANCELLED' } }),
      ]);
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: eventType });
  } catch (error) {
    console.error(`XPayments webhook ${eventId} processing error`, error instanceof Error ? error.message : 'unknown');
    await db.webhookEvent.delete({ where: { id: eventId } }).catch(() => undefined);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}
