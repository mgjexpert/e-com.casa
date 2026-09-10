// ============================================================
// POST /api/webhooks/xpayments  (§36–§40, §70, §88, §89)
// ------------------------------------------------------------
// Secure, idempotent, monotonic webhook receiver for the XPayments
// merchant webhook.
//
//  - Signature verification is FAIL-CLOSED (provider.verifyWebhook);
//    unverified deliveries are rejected with 400.
//  - Event ids are persisted (WebhookEvent) — redelivery never
//    double-charges, double-invoices, double-decrements stock or
//    double-sends email (§37, §88).
//  - State transitions are monotonic (§70): a late stale event can
//    never move PAID back to PENDING.
//  - An order becomes PAID only through this verified path (§102).
//  - Stock is finalised here, not at checkout (§39).
//  - Invoice creation follows payment success (§43, §90).
//  - Safe logging only: order number, intent id, event id, status
//    (§67) — never secrets, client secrets or card data.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clientIp } from '@/lib/rate-limit';
import { getPaymentProvider } from '@/lib/payments/xpayments-provider';
import { PAYMENT_STATUS_RANK, normaliseGatewayIntentStatus } from '@/lib/payments/payment-types';
import type { StripeLikeIntent } from '@/lib/payments/payment-types';
import { assignTrackingFields } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

/** Map a normalised intent status onto the order payment status. */
function intentStatusToOrderStatus(intentStatus: string): string | null {
  switch (intentStatus) {
    case 'SUCCEEDED': return 'PAID';
    case 'PROCESSING': return 'PAYMENT_PROCESSING';
    case 'REQUIRES_ACTION':
    case 'REQUIRES_PAYMENT_METHOD':
    case 'CREATED': return 'PENDING_PAYMENT';
    case 'FAILED': return 'PAYMENT_FAILED';
    case 'CANCELLED': return 'CANCELLED';
    case 'REFUNDED': return 'REFUNDED';
    case 'PARTIALLY_REFUNDED': return 'PARTIALLY_REFUNDED';
    default: return null;
  }
}

/** Normalised view of an incoming event. */
interface ParsedEvent {
  paymentIntentId: string;
  refundId: string | null;
  amountRefundedMinor: number | null;
  intent: StripeLikeIntent;
}

/** Extract a Stripe-like intent from the supported event shapes. */
function extractEvent(payload: Record<string, unknown>): ParsedEvent | null {
  // Shape 1 — Stripe-style event: { id, type, data: { object: … } }
  const data = payload.data as { object?: Record<string, unknown> } | undefined;
  if (data?.object) {
    const obj = data.object;
    const objectType = String(obj.object ?? '');
    if (objectType === 'payment_intent') {
      return { paymentIntentId: String(obj.id), refundId: null, amountRefundedMinor: null, intent: obj as StripeLikeIntent };
    }
    if (objectType === 'charge' && typeof obj.payment_intent === 'string') {
      return {
        paymentIntentId: obj.payment_intent,
        refundId: null,
        amountRefundedMinor: typeof obj.amount_refunded === 'number' && obj.amount_refunded > 0 ? obj.amount_refunded : null,
        intent: { id: obj.payment_intent, status: payload.type === 'charge.refunded' ? 'REFUNDED' : (obj.status as string | undefined), amount: obj.amount as number | undefined, currency: obj.currency as string | undefined },
      };
    }
    if (objectType === 'refund' && typeof obj.payment_intent === 'string') {
      return {
        paymentIntentId: obj.payment_intent,
        refundId: typeof obj.id === 'string' ? obj.id : null,
        amountRefundedMinor: typeof obj.amount === 'number' ? obj.amount : null,
        intent: { id: obj.payment_intent, status: 'REFUNDED', amount: obj.amount as number | undefined, currency: obj.currency as string | undefined },
      };
    }
  }
  // Shape 2 — normalised merchant payload: { payment_intent: {...} | "pi_…" }
  const pi = payload.payment_intent;
  if (typeof pi === 'string') {
    return { paymentIntentId: pi, refundId: null, amountRefundedMinor: null, intent: { id: pi, status: typeof payload.status === 'string' ? payload.status : undefined } };
  }
  if (pi && typeof pi === 'object') {
    const piObj = pi as Record<string, unknown>;
    return { paymentIntentId: String(piObj.id), refundId: null, amountRefundedMinor: null, intent: piObj as StripeLikeIntent };
  }
  // Shape 3 — the intent itself
  if (payload.object === 'payment_intent') {
    return { paymentIntentId: String(payload.id), refundId: null, amountRefundedMinor: null, intent: payload as StripeLikeIntent };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers: Record<string, string | undefined> = {};
  for (const name of ['x-webhook-signature', 'x-xpayments-signature', 'stripe-signature', 'x-signature', 'user-agent']) {
    headers[name] = req.headers.get(name) ?? undefined;
  }

  // ---- 1. Verify (fail-closed) ------------------------------------
  const provider = getPaymentProvider();
  const verification = provider.verifyWebhook(rawBody, headers);
  if (!verification.ok) {
    console.warn(`webhook rejected (${verification.reason}) ip=${clientIp(req)}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ---- 2. Parse ----------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const eventId = String(payload.id ?? `evt_${crypto.randomUUID()}`);
  const eventType = String(payload.type ?? payload.event ?? 'unknown');

  // ---- 3. Idempotency (§37) ---------------------------------------
  try {
    await db.webhookEvent.create({
      data: { id: eventId, provider: provider.name, type: eventType, payloadJson: rawBody.slice(0, 20_000) },
    });
  } catch {
    // unique violation → this event was already processed
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ---- 4. Apply the event -----------------------------------------
  try {
    const event = extractEvent(payload);
    if (!event?.paymentIntentId) {
      console.log(`webhook ${eventId} (${eventType}): no payment_intent — acknowledged`);
      return NextResponse.json({ received: true });
    }
    const { paymentIntentId, refundId, amountRefundedMinor } = event;
    // Raw gateway payloads carry lowercase Stripe statuses — normalise
    // once, everything below works on the E-com.casa enum.
    const intent: StripeLikeIntent = { ...event.intent, status: normaliseGatewayIntentStatus(event.intent.status) };

    const payment = await db.payment.findUnique({
      where: { paymentIntentId },
      include: { order: true },
    });
    if (!payment) {
      console.log(`webhook ${eventId} (${eventType}): unknown intent — acknowledged`);
      return NextResponse.json({ received: true });
    }
    const order = payment.order;

    // Refund flows --------------------------------------------------
    if (eventType.includes('refund') || intent.status === 'REFUNDED' || (amountRefundedMinor ?? 0) > 0) {
      const full =
        payment.amountMinor !== null &&
        (amountRefundedMinor ?? 0) >= payment.amountMinor &&
        (amountRefundedMinor ?? 0) > 0;
      const nextStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED' | null =
        full ? 'REFUNDED' : (amountRefundedMinor ?? 0) > 0 ? 'PARTIALLY_REFUNDED' : null;
      if (nextStatus) {
        await applyRefunded(payment.id, order.id, nextStatus, eventId, eventType, intent, refundId);
      }
      return NextResponse.json({ received: true });
    }

    const nextOrderStatus = intentStatusToOrderStatus(String(intent.status ?? ''));
    if (!nextOrderStatus) {
      return NextResponse.json({ received: true });
    }

    // ---- 5. Monotonic transition (§70) ----------------------------
    const currentRank = PAYMENT_STATUS_RANK[order.paymentStatus] ?? 0;
    const nextRank = PAYMENT_STATUS_RANK[nextOrderStatus] ?? 0;
    if (nextRank < currentRank) {
      console.log(`webhook ${eventId}: ignored stale transition ${order.paymentStatus} → ${nextOrderStatus} (order ${order.orderNumber})`);
      return NextResponse.json({ received: true, ignored: 'stale_event' });
    }
    if (nextRank === currentRank && order.paymentStatus === nextOrderStatus) {
      await db.payment.update({ where: { id: payment.id }, data: { lastEventId: eventId } });
      return NextResponse.json({ received: true, noop: true });
    }

    // ---- 6. PAID path: fulfilment, stock, invoice (§39, §40, §43) --
    if (nextOrderStatus === 'PAID') {
      const paidAtNow = new Date();
      // Tracking & fulfilment logistics are assigned exactly once, at
      // the verified-payment moment — buyers get a tracking number for
      // every paid order (3PL simulation engine).
      const tracking = assignTrackingFields(
        order.orderNumber,
        order.shippingMethod,
        order.country,
        paidAtNow,
      );
      await db.$transaction(async (tx) => {
        // payment row first (server-authoritative record)
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: paidAtNow,
            lastEventId: eventId,
            failureCode: null,
            failureMessage: null,
            paymentMethodType: payment.paymentMethodType ?? 'other',
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            paidAt: paidAtNow,
            status: 'CONFIRMED', // fulfilment starts only after verified payment (§40)
            paymentMethodType: payment.paymentMethodType ?? 'other',
            paymentFailureReason: null,
            trackingNumber: tracking.trackingNumber,
            carrier: tracking.carrier,
            originWarehouse: tracking.originWarehouse,
            estimatedDeliveryAt: tracking.estimatedDeliveryAt,
          },
        });

        // Final stock decrement happens exactly once, here (§39).
        if (!order.stockApplied) {
          const items = JSON.parse(order.itemsJson) as { slug: string; quantity: number }[];
          for (const item of items) {
            await tx.product.updateMany({
              where: { slug: item.slug, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
          }
          await tx.order.update({ where: { id: order.id }, data: { stockApplied: true } });
        }

        // Invoice record after payment success (§43) — issuance is
        // country-adapter-ready; PDF generation attaches later.
        const existingInvoice = await tx.invoice.findUnique({ where: { orderId: order.id } });
        if (!existingInvoice) {
          await tx.invoice.create({
            data: {
              orderId: order.id,
              invoiceNumber: `INV-${order.orderNumber.replace('EC-', '')}`,
              country: order.country,
              currency: order.currency,
              subtotal: order.subtotal,
              shipping: order.shipping,
              tax: order.tax,
              discount: order.discount,
              total: order.total,
              status: 'ISSUED',
            },
          });
        }
      });

      // Email architecture (§72): payment-confirmed mail is queued by
      // the notification worker — never sent before this verified point.
      console.log(`payment confirmed: order=${order.orderNumber} intent=${intent.id} event=${eventId}`);
      return NextResponse.json({ received: true });
    }

    // ---- 7. Non-PAID transitions ----------------------------------
    if (nextOrderStatus === 'PAYMENT_FAILED') {
      const err = (intent as StripeLikeIntent).last_payment_error;
      await db.$transaction([
        db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            lastEventId: eventId,
            failureCode: String(err?.code ?? 'payment_failed').slice(0, 120),
            // store a sanitised provider message — never raw payloads
            failureMessage: String(err?.message ?? 'Payment failed').slice(0, 300),
          },
        }),
        db.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            provider: provider.name,
            paymentMethodType: payment.paymentMethodType,
            providerReference: String(intent.id),
            status: 'FAILED',
            amount: payment.amount,
            currency: payment.currency,
            errorCode: String(err?.code ?? 'payment_failed').slice(0, 120),
            errorMessage: String(err?.message ?? 'Payment failed').slice(0, 300),
          },
        }),
        db.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAYMENT_FAILED',
            paymentFailureReason: String(err?.code ?? 'payment_failed').slice(0, 120),
          },
        }),
      ]);
      console.log(`payment failed: order=${order.orderNumber} intent=${intent.id} event=${eventId}`);
      return NextResponse.json({ received: true });
    }

    // PROCESSING / REQUIRES_ACTION / PENDING_PAYMENT / CANCELLED
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: { status: String(intent.status), lastEventId: eventId },
      }),
      db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: nextOrderStatus,
          ...(nextOrderStatus === 'CANCELLED' ? { status: 'CANCELLED' } : {}),
        },
      }),
    ]);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`webhook ${eventId} processing error`, error);
    // 500 → the gateway will retry; idempotency guard prevents duplicates
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

async function applyRefunded(
  paymentId: string,
  orderId: string,
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED',
  eventId: string,
  eventType: string,
  intent: StripeLikeIntent,
  refundId: string | null,
) {
  const refundRef = refundId ?? `re_${eventId}`;
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status, lastEventId: eventId },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: status },
    });
    const existing = await tx.refund.findUnique({ where: { refundId: refundRef } });
    if (!existing) {
      await tx.refund.create({
        data: {
          paymentId,
          refundId: refundRef,
          amount: '0.00',
          currency: (intent.currency ?? 'EUR').toUpperCase(),
          reason: eventType,
          status: 'SUCCEEDED',
        },
      });
    }
    // credit note skeleton (§42) — fiscal issuance stays adapter-ready
    const cn = await tx.creditNote.findFirst({ where: { orderId, refundId: refundRef } });
    if (!cn) {
      await tx.creditNote.create({
        data: {
          orderId,
          refundId: refundRef,
          number: `CN-${refundRef.slice(-10).toUpperCase()}`,
          amount: '0.00',
          currency: (intent.currency ?? 'EUR').toUpperCase(),
          reason: eventType,
          status: 'ISSUED',
        },
      });
    }
  });
  console.log(`refund applied: order status=${status} event=${eventId}`);
}
