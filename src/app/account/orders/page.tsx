'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package, Search, ChevronRight, CircleCheck, Truck, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatPrice, formatDate } from '@/lib/format';
import type { Order, OrderItem } from '@/types';

const STATUS_STEPS = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export default function OrderHistoryPage() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setOrders(data.orders ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-ecom py-10 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[32px]">My orders</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Enter the email you used at checkout to see your order history and track deliveries.
        </p>

        <form onSubmit={lookup} className="mt-6 flex max-w-md gap-2" role="search" aria-label="Order lookup">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address used at checkout"
            className="h-11 rounded-md"
          />
          <Button type="submit" disabled={loading} className="h-11 shrink-0 gap-2 rounded-md bg-primary px-5">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" strokeWidth={2} />}
            Find orders
          </Button>
        </form>
        {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

        {orders && orders.length === 0 && (
          <div className="mt-10 rounded-lg border border-border bg-cream/50 px-6 py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-display mt-4 text-[19px]">No orders yet</p>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              When you place an order it will appear here. Start with a best seller.
            </p>
            <Button asChild className="mt-5 rounded-md">
              <Link href="/shop">Browse the shop</Link>
            </Button>
          </div>
        )}

        {orders && orders.length > 0 && (
          <ul className="mt-8 space-y-5" aria-label="Order history">
            {orders.map((order) => {
              let items: OrderItem[] = [];
              try {
                items = JSON.parse(order.itemsJson);
              } catch {
                items = [];
              }
              const stepIndex = STATUS_STEPS.indexOf(order.status);
              return (
                <li key={order.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-cream/40 px-5 py-4">
                    <div>
                      <p className="font-display text-[16px] font-medium">{order.orderNumber}</p>
                      <p className="text-[12px] text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-olive/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-olive">
                        {order.status}
                      </span>
                      <p className="text-[15px] font-semibold">{formatPrice(order.total)}</p>
                    </div>
                  </div>

                  {/* Tracker */}
                  <div className="border-b border-border px-5 py-4">
                    <ol className="flex items-center" aria-label={`Order status: ${order.status}`}>
                      {STATUS_STEPS.map((step, i) => (
                        <li key={step} className="flex flex-1 items-center last:flex-none">
                          <span className="flex flex-col items-center gap-1.5">
                            {i <= stepIndex ? (
                              <CircleCheck className="h-5 w-5 text-olive" strokeWidth={1.5} />
                            ) : (
                              <span className="h-5 w-5 rounded-full border-2 border-border" aria-hidden />
                            )}
                            <span className={`text-[10px] font-medium capitalize ${i <= stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.toLowerCase()}
                            </span>
                          </span>
                          {i < STATUS_STEPS.length - 1 && (
                            <span className={`mx-2 mb-4 h-px flex-1 ${i < stepIndex ? 'bg-olive' : 'bg-border'}`} aria-hidden />
                          )}
                        </li>
                      ))}
                    </ol>
                    {order.status === 'SHIPPED' && (
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Truck className="h-3.5 w-3.5 text-olive" /> Tracking number will arrive by email.
                      </p>
                    )}
                  </div>

                  <ul className="divide-y divide-border/70 px-5">
                    {items.map((item) => (
                      <li key={item.slug} className="flex items-center gap-3.5 py-3.5">
                        <Link href={`/product/${item.slug}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/60">
                          <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-[13px] font-medium">{item.name}</p>
                          <p className="text-[12px] text-muted-foreground">Qty {item.quantity}</p>
                        </div>
                        <p className="text-[13px] font-medium">{formatPrice(parseFloat(item.price) * item.quantity)}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border/70 px-5 py-3">
                    <Link href={`/checkout/success?order=${order.orderNumber}`} className="flex items-center gap-1 text-[12.5px] font-medium text-olive hover:underline">
                      View order details <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
