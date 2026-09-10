// ============================================================
// POST /api/payments/create-intent  (§4, §5, §10, §12, §22, §23)
// ------------------------------------------------------------
// Creates (or safely reuses) an XPayments PaymentIntent for a
// PENDING_PAYMENT order and returns the client_secret the
// browser needs for Stripe Elements.
//
// Guarantees:
//  - orderNumber + access token required (never client-trusted totals)
//  - one PaymentIntent per pricing state; retries reuse the intent
//  - Idempotency-Key on every creation (ecom-order-<num>-<hash>)
//  - amount = server-calculated total in the smallest currency unit
//  - secrets never leave the server
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { tokenMatches } from '@/lib/checkout';
import { getPaymentProvider } from '@/lib/payments/xpayments-provider';
import { isPaymentConfigured } from '@/lib/payments/payments-config';
import { resolvePaymentCapabilities } from '@/lib/payments/payment-capabilities';
import { toMinorUnit } from '@/lib/payments/amounts';
import { PaymentError } from '@/lib/payments/payment-errors';
import type { PaymentStatus } from '@/lib/payments/payment-types';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderNumber: z.string().min(3).max(40),
  accessToken: z.string().min(8).max(120),
});

/** Intent states we can safely reuse for another confirmation attempt. */
const REUSABLE: PaymentStatus[] = [
  'CREATED',
  'REQUIRES_PAYMENT_METHOD',
  'REQUIRES_ACTION',
  'PROCESSING',
];

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, 'create-intent', 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 });
    }
    const { orderNumber, accessToken } = parsed.data;

    const order = await db.order.findUnique({
      where: { orderNumber },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order || !tokenMatches(order.accessToken, accessToken)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 409 });
    }
    if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      return NextResponse.json({ error: 'Order payment is closed' }, { status: 409 });
    }

    // Configuration gate — no real intent without credentials (§102)
    if (!isPaymentConfigured()) {
      console.error('create-intent: payment gateway not configured (missing XPAYMENTS_SECRET_KEY or publishable key)');
      return NextResponse.json(
        { error: 'Online payments are temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    const provider = getPaymentProvider();
    const capabilities = resolvePaymentCapabilities(order.country, order.currency);
    const amountMinor = toMinorUnit(order.total, order.currency);
    const idempotencyKey = `ecom-order-${order.orderNumber}-${order.pricingHash ?? 'v1'}`;

    const existing = order.payments[0] ?? null;
    let intent;

    // Safe retry: reuse the persisted intent when it is still open
    // and the amount is unchanged (§23, §69) — never mint duplicate
    // intents on re-renders or customer retries.
    if (
      existing &&
      existing.paymentIntentId === order.paymentIntentId &&
      existing.status &&
      REUSABLE.includes(existing.status as PaymentStatus)
    ) {
      try {
        intent = await provider.retrievePaymentIntent(existing.paymentIntentId);
      } catch {
        intent = null;
      }
      if (intent && intent.amountMinor === amountMinor && REUSABLE.includes(intent.status)) {
        await db.payment.updateMany({
          where: { orderId: order.id },
          data: { status: intent.status, provider: provider.name },
        });
        return NextResponse.json({
          paymentIntentId: intent.id,
          clientSecret: intent.clientSecret,
          amountMinor,
          currency: order.currency,
          environment: provider.getPaymentCapabilities().environment,
          methods: capabilities.methods.filter((m) => m.enabled),
        });
      }
    }

    // Stale / failed-terminal intent → cancel best-effort, create a
    // fresh one under a stable idempotency key (§10, §69).
    if (existing?.paymentIntentId) {
      try {
        await provider.cancelPaymentIntent(existing.paymentIntentId);
      } catch {
        // cancellation is best-effort; the new intent is authoritative
      }
    }

    intent = await provider.createPaymentIntent({
      amountMinor,
      currency: order.currency,
      idempotencyKey,
      orderNumber: order.orderNumber,
      customerCountry: order.country,
      customerEmail: order.email,
      description: `E-com.casa ${order.orderNumber}`,
    });

    // Persist the intent immediately (§23) and mirror order fields.
    await db.$transaction([
      db.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          provider: provider.name,
          paymentIntentId: intent.id,
          amount: order.total,
          amountMinor,
          currency: order.currency,
          status: intent.status,
          clientSecretCreatedAt: new Date(),
        },
        update: {
          provider: provider.name,
          paymentIntentId: intent.id,
          amount: order.total,
          amountMinor,
          currency: order.currency,
          status: intent.status,
          clientSecretCreatedAt: new Date(),
          failureCode: null,
          failureMessage: null,
          failedAt: null,
        },
      }),
      db.order.update({
        where: { id: order.id },
        data: {
          paymentProvider: provider.name,
          paymentIntentId: intent.id,
          paymentStatus: intent.status === 'PROCESSING' ? 'PAYMENT_PROCESSING' : 'PENDING_PAYMENT',
        },
      }),
      // audit trail (§89)
      db.paymentAttempt.create({
        data: {
          paymentId: (await db.payment.findUnique({ where: { orderId: order.id } }))!.id,
          provider: provider.name,
          providerReference: intent.id,
          status: intent.status,
          amount: order.total,
          currency: order.currency,
        },
      }),
    ]);

    return NextResponse.json({
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
      amountMinor,
      currency: order.currency,
      environment: provider.getPaymentCapabilities().environment,
      methods: capabilities.methods.filter((m) => m.enabled),
    });
  } catch (error) {
    const perr = error instanceof PaymentError ? error : null;
    console.error('POST /api/payments/create-intent error', perr?.code ?? error);
    const status = perr?.httpStatus ?? 500;
    const message =
      perr?.code === 'PAYMENT_CONFIGURATION_ERROR'
        ? 'Online payments are temporarily unavailable. Please try again shortly.'
        : 'We could not start the payment. Please try again.';
    return NextResponse.json({ error: message }, { status });
  }
}
