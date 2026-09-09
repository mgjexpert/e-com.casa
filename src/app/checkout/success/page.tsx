import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckCircle2, Gift, Package, Mail, Truck, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { formatPrice, formatDate } from '@/lib/format';
import { GIFT_WRAP_PRICE } from '@/lib/constants';
import type { Order } from '@/types';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false },
};

async function getOrder(orderNumber: string): Promise<Order | null> {
  try {
    const order = await db.order.findUnique({ where: { orderNumber } });
    return (order as unknown as Order) ?? null;
  } catch {
    return null;
  }
}

async function OrderContent({ orderNumber }: { orderNumber: string }) {
  const order = await getOrder(orderNumber);

  if (!order) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-[26px] font-medium">Order not found</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          We could not find order {orderNumber}. Check your confirmation email or contact support.
        </p>
        <Button asChild className="mt-6 rounded-md">
          <Link href="/account/orders">Find my order</Link>
        </Button>
      </div>
    );
  }

  let items: { slug: string; name: string; image: string; price: string; quantity: number }[] = [];
  try {
    items = JSON.parse(order.itemsJson);
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-olive/12">
          <CheckCircle2 className="h-8 w-8 text-olive" strokeWidth={1.5} />
        </span>
        <h1 className="font-display mt-5 text-[30px] font-medium tracking-tight">Thank you, {order.firstName}.</h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">
          Your order is confirmed. A confirmation email is on its way to{' '}
          <strong className="text-foreground">{order.email}</strong>.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Order number</p>
            <p className="font-display mt-1 flex items-center gap-2 text-[20px] font-medium">
              {order.orderNumber}
              {order.giftWrap && (
                <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-terracotta">
                  <Gift className="h-3 w-3" strokeWidth={2} /> Gift
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Placed</p>
            <p className="mt-1 text-[13.5px]">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-4 border-t border-border pt-5">
          {items.map((item) => (
            <li key={item.slug} className="flex items-center gap-4">
              <Link href={`/product/${item.slug}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60">
                <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/product/${item.slug}`} className="line-clamp-1 text-[13.5px] font-medium hover:underline">
                  {item.name}
                </Link>
                <p className="text-[12px] text-muted-foreground">Qty {item.quantity}</p>
              </div>
              <p className="text-[13.5px] font-semibold">{formatPrice(parseFloat(item.price) * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2 border-t border-border pt-5 text-[13.5px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {parseFloat(order.discount) > 0 && (
            <div className="flex justify-between text-olive">
              <dt>Discount {order.promoCode ? `(${order.promoCode})` : ''}</dt>
              <dd>−{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping ({order.shippingMethod})</dt>
            <dd>{parseFloat(order.shipping) === 0 ? 'Free' : formatPrice(order.shipping)}</dd>
          </div>
          {order.giftWrap && (
            <div className="flex justify-between text-terracotta">
              <dt className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5" strokeWidth={1.5} /> Gift wrap
              </dt>
              <dd>+{formatPrice(GIFT_WRAP_PRICE)}</dd>
            </div>
          )}
          <div className="flex justify-between text-[16px] font-semibold">
            <dt>Total (VAT incl.)</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-4 rounded-md bg-cream/60 p-4 text-[12.5px] leading-relaxed sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <Package className="h-3.5 w-3.5 text-olive" /> Delivery address
            </p>
            <p className="mt-1.5 text-muted-foreground">
              {order.firstName} {order.lastName}
              <br />
              {order.address}{order.address2 ? `, ${order.address2}` : ''}
              <br />
              {order.postalCode} {order.city}, {order.country}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <Truck className="h-3.5 w-3.5 text-olive" /> What happens next
            </p>
            <p className="mt-1.5 text-muted-foreground">
              We prepare your order within 24–48h. You will receive tracking by email as soon as it ships
              ({order.shippingMethod === 'express' ? '1–2' : '3–5'} working days).
            </p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="flex items-center gap-1.5 font-semibold">
                <StickyNote className="h-3.5 w-3.5 text-terracotta" /> Your delivery note
              </p>
              <p className="mt-1.5 whitespace-pre-line rounded-md border border-border/70 bg-background px-3 py-2 text-muted-foreground">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" className="rounded-md">
          <Link href="/account/orders">
            <Mail className="mr-2 h-4 w-4" /> Track this order
          </Link>
        </Button>
        <Button asChild className="rounded-md bg-primary">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  return (
    <div className="container-ecom py-12 lg:py-16">
      {orderNumber ? (
        <Suspense
          fallback={
            <div className="py-16 text-center text-[14px] text-muted-foreground">Loading your order…</div>
          }
        >
          <OrderContent orderNumber={orderNumber} />
        </Suspense>
      ) : (
        <div className="py-16 text-center">
          <h1 className="font-display text-[26px] font-medium">Order confirmed</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            No order reference found. Check <Link href="/account/orders" className="text-olive underline">your orders</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
