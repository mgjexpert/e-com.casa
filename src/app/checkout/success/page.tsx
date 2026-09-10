import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { tokenMatches } from '@/lib/checkout';
import { ensureTracking } from '@/lib/tracking';
import { SuccessView, type SuccessOrderData } from './success-view';

export const metadata: Metadata = {
  title: 'Order status',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

async function loadOrder(orderNumber: string, token: string): Promise<SuccessOrderData | null> {
  try {
    const order = await db.order.findUnique({
      where: { orderNumber },
      include: { invoices: { select: { invoiceNumber: true } } },
    });
    if (!order || !tokenMatches(order.accessToken, token)) return null;

    // Keep the tracking lifecycle moving on this read (idempotent).
    const tracked = await ensureTracking(order);
    const trackedOrder = tracked.order;

    let items: { slug: string; name: string; image: string; price: string; quantity: number; variantLabel?: string | null }[] = [];
    try {
      items = JSON.parse(order.itemsJson);
    } catch {
      items = [];
    }

    return {
      orderNumber: trackedOrder.orderNumber,
      status: trackedOrder.paymentStatus,
      fulfilmentStatus: trackedOrder.status,
      email: trackedOrder.email,
      firstName: trackedOrder.firstName,
      lastName: trackedOrder.lastName,
      address: trackedOrder.address,
      address2: trackedOrder.address2,
      city: trackedOrder.city,
      postalCode: trackedOrder.postalCode,
      country: trackedOrder.country,
      shippingMethod: trackedOrder.shippingMethod,
      subtotal: trackedOrder.subtotal,
      shipping: trackedOrder.shipping,
      discount: trackedOrder.discount,
      total: trackedOrder.total,
      promoCode: trackedOrder.promoCode,
      giftWrap: trackedOrder.giftWrap,
      notes: trackedOrder.notes,
      currency: trackedOrder.currency,
      paymentMethodType: trackedOrder.paymentMethodType,
      createdAt: trackedOrder.createdAt.toISOString(),
      invoiceNumber: trackedOrder.invoices[0]?.invoiceNumber ?? null,
      trackingNumber: trackedOrder.trackingNumber,
      items,
    };
  } catch {
    return null;
  }
}

async function OrderContent({ orderNumber, token }: { orderNumber: string; token: string }) {
  const data = await loadOrder(orderNumber, token);

  if (!data) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-[26px] font-medium">Order not found</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          We could not find order {orderNumber}. Check your confirmation email or contact support.
        </p>
        <Link href="/shop" className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-7 text-[14px] font-semibold text-primary-foreground">
          Continue shopping
        </Link>
      </div>
    );
  }

  return <SuccessView order={data} token={token} />;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order: orderNumber, token } = await searchParams;

  return (
    <div className="container-ecom py-12 lg:py-16">
      {orderNumber && token ? (
        <Suspense
          fallback={
            <div className="py-16 text-center text-[14px] text-muted-foreground">Checking your order…</div>
          }
        >
          <OrderContent orderNumber={orderNumber} token={token} />
        </Suspense>
      ) : (
        // No token → show nothing about any order (§60, §71)
        <div className="py-16 text-center">
          <h1 className="font-display text-[26px] font-medium">Order status</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Open the link from your order confirmation email, or{' '}
            <Link href="/contact" className="text-olive underline underline-offset-2">contact support</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
