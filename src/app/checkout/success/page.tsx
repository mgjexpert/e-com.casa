import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { tokenMatches } from '@/lib/checkout';
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

    let items: { slug: string; name: string; image: string; price: string; quantity: number; variantLabel?: string | null }[] = [];
    try {
      items = JSON.parse(order.itemsJson);
    } catch {
      items = [];
    }

    return {
      orderNumber: order.orderNumber,
      status: order.paymentStatus,
      fulfilmentStatus: order.status,
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
      discount: order.discount,
      total: order.total,
      promoCode: order.promoCode,
      giftWrap: order.giftWrap,
      notes: order.notes,
      currency: order.currency,
      paymentMethodType: order.paymentMethodType,
      createdAt: order.createdAt.toISOString(),
      invoiceNumber: order.invoices[0]?.invoiceNumber ?? null,
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
