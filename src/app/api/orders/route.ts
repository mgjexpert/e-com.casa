// ============================================================
// GET /api/orders?order=EC-…&token=…  (§59, §60)
// ------------------------------------------------------------
// Secure single-order lookup. The historical email-only listing
// endpoint was removed: arbitrary order histories can never be
// enumerated. Access requires the order number plus the random
// access token issued once at checkout.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { tokenMatches } from '@/lib/checkout';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = rateLimit(req, 'order-lookup', 30, 60_000);
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
      return NextResponse.json(
        { error: 'Order number and access token are required.' },
        { status: 400 },
      );
    }

    const order = await db.order.findUnique({ where: { orderNumber } });
    if (!order || !tokenMatches(order.accessToken, token)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const invoice = await db.invoice.findUnique({ where: { orderId: order.id } });

    return NextResponse.json({
      order: {
        orderNumber: order.orderNumber,
        email: order.email,
        firstName: order.firstName,
        lastName: order.lastName,
        address: order.address,
        address2: order.address2,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country,
        shippingMethod: order.shippingMethod,
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        promoCode: order.promoCode,
        itemsJson: order.itemsJson,
        giftWrap: order.giftWrap,
        notes: order.notes,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethodType: order.paymentMethodType,
        currency: order.currency,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
      },
      invoice: invoice
        ? { invoiceNumber: invoice.invoiceNumber, status: invoice.status, issuedAt: invoice.issuedAt }
        : null,
    });
  } catch (error) {
    console.error('GET /api/orders error', error);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}

/** Order creation moved to /api/checkout/create — the mock paid-order
 *  endpoint is gone for good. */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Order creation moved to /api/checkout/create. Orders are never marked paid at creation.',
    },
    { status: 410 },
  );
}
