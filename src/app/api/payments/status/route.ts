// ============================================================
// GET /api/payments/status?order=…&token=…  (§34, §60, §71)
// ------------------------------------------------------------
// Server-authoritative payment status for one order. Email-only
// lookups are NOT allowed; the random access token issued at
// checkout is required. Returns the minimum the customer needs —
// never gateway internals.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { tokenMatches } from '@/lib/checkout';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = rateLimit(req, 'payment-status', 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get('order') ?? '';
    const token = searchParams.get('token') ?? '';
    if (!orderNumber || !token) {
      return NextResponse.json({ error: 'Order and token are required' }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        accessToken: true,
        paymentStatus: true,
        paymentMethodType: true,
        status: true,
        total: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        paymentFailureReason: true,
      },
    });
    if (!order || !tokenMatches(order.accessToken, token)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Server-side truth: reflect a verified SUCCEEDED payment even if
    // the order-row update is lagging, so a customer refresh never lies.
    let verifiedStatus = order.paymentStatus;
    if (['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.paymentStatus)) {
      const payment = await db.payment.findUnique({ where: { orderId: order.id } });
      if (payment?.status === 'SUCCEEDED') {
        verifiedStatus = 'PAID';
      }
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      paymentStatus: verifiedStatus,
      orderStatus: order.status,
      paymentMethodType: order.paymentMethodType,
      total: order.total,
      currency: order.currency,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error(`GET /api/payments/status error (${clientIp(req)})`, error);
    return NextResponse.json({ error: 'Failed to load payment status' }, { status: 500 });
  }
}
