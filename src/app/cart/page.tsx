'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, Heart, ShoppingBag, ShieldCheck, RotateCcw, Truck, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { formatPrice, toNumber, money } from '@/lib/format';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_OPTIONS, PROMO_CODES } from '@/lib/constants';
import type { Product } from '@/types';
import { useEffect, useState } from 'react';

export default function CartPage() {
  const cart = useCart();
  const wishlist = useWishlist();
  const [promoInput, setPromoInput] = useState('');
  const [suggested, setSuggested] = useState<Product[]>([]);

  const lines = cart.lines;
  const subtotal = toNumber(cart.subtotal().toFixed(2));
  const promo = cart.promoCode ? PROMO_CODES[cart.promoCode] : null;
  const discount = promo ? (subtotal * promo.value) / 100 : 0;
  const freeShipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD;
  const shippingEstimate = freeShipping ? 0 : SHIPPING_OPTIONS[0].price;
  const total = Math.max(0, subtotal - discount + shippingEstimate);
  const progress = Math.min(100, ((subtotal - discount) / FREE_SHIPPING_THRESHOLD) * 100);

  useEffect(() => {
    if (lines.length === 0) return;
    fetch('/api/products?sort=best&perPage=4')
      .then((r) => r.json())
      .then((d) => setSuggested((d.products ?? []).filter((p: Product) => !lines.some((l) => l.slug === p.slug)).slice(0, 4)))
      .catch(() => {});
  }, []);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (PROMO_CODES[code]) {
      cart.setPromo(code);
      toast({ title: 'Promo applied', description: PROMO_CODES[code].label });
      setPromoInput('');
    } else {
      toast({ title: 'Invalid code', description: 'This promo code does not exist or has expired.', variant: 'destructive' });
    }
  };

  const moveToWishlist = (slug: string) => {
    const line = lines.find((l) => l.slug === slug);
    if (!line) return;
    wishlist.toggle(slug);
    cart.remove(slug);
    toast({ title: 'Moved to wishlist', description: line.name });
  };

  if (lines.length === 0) {
    return (
      <div className="container-ecom flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream">
          <ShoppingBag className="h-7 w-7 text-olive" strokeWidth={1.5} />
        </span>
        <h1 className="font-display mt-6 text-[28px] font-medium">Your cart is empty</h1>
        <p className="mt-2 max-w-sm text-[14px] text-muted-foreground">
          Every great space starts with one piece. Explore the collection and find yours.
        </p>
        <Link href="/shop" className="mt-7 inline-flex h-12 items-center rounded-md bg-primary px-8 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-ecom py-8 lg:py-12">
      <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[32px]">Your cart</h1>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        {lines.length} {lines.length === 1 ? 'item' : 'items'} · prices include VAT
      </p>

      {/* Free shipping progress */}
      <div className="mt-6 rounded-lg border border-border bg-cream/60 p-4">
        <p className="text-[13px]">
          {freeShipping ? (
            <span className="font-medium text-olive">You have unlocked free standard shipping across Europe.</span>
          ) : (
            <>
              You are <strong>{formatPrice(FREE_SHIPPING_THRESHOLD - (subtotal - discount))}</strong> away from free standard shipping.
            </>
          )}
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-olive transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to free shipping"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Lines */}
        <section aria-label="Cart items">
          <ul className="divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <li key={line.slug} className="flex gap-4 py-5">
                <Link href={`/product/${line.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40 sm:h-28 sm:w-28">
                  <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/product/${line.slug}`} className="line-clamp-1 text-[14.5px] font-medium hover:underline">
                        {line.name}
                      </Link>
                      {line.subtitle && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-muted-foreground">{line.subtitle}</p>}
                    </div>
                    <p className="shrink-0 text-[14.5px] font-semibold">{formatPrice(toNumber(line.price) * line.quantity)}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="flex h-9 items-center rounded-md border border-input">
                      <button
                        type="button"
                        onClick={() => cart.setQty(line.slug, line.quantity - 1)}
                        className="flex h-full w-9 items-center justify-center hover:bg-accent"
                        aria-label={`Decrease quantity of ${line.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-[13px] font-medium tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => cart.setQty(line.slug, line.quantity + 1)}
                        className="flex h-full w-9 items-center justify-center hover:bg-accent"
                        aria-label={`Increase quantity of ${line.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => moveToWishlist(line.slug)}
                        className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Heart className="h-3.5 w-3.5" strokeWidth={1.75} /> Save for later
                      </button>
                      <button
                        type="button"
                        onClick={() => cart.remove(line.slug)}
                        className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove ${line.name} from cart`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Suggestions */}
          {suggested.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-[20px] font-medium">Complete the look</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {suggested.map((p) => (
                  <Link key={p.id} href={`/product/${p.slug}`} className="group">
                    <div className="relative aspect-square overflow-hidden rounded-md border border-border/60">
                      <Image src={p.image} alt={p.name} fill sizes="200px" className="img-zoom object-cover" />
                    </div>
                    <p className="mt-2 line-clamp-1 text-[13px] font-medium">{p.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">{formatPrice(p.price)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Summary */}
        <aside aria-label="Order summary">
          <div className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-32">
            <h2 className="font-display text-[20px] font-medium">Order summary</h2>

            {/* Promo */}
            <div className="mt-5">
              {cart.promoCode && promo ? (
                <div className="flex items-center justify-between rounded-md bg-olive/10 px-3.5 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-olive">
                    <Tag className="h-3.5 w-3.5" /> {cart.promoCode} — {promo.label}
                  </span>
                  <button type="button" onClick={() => cart.setPromo(null)} className="text-[12px] text-muted-foreground hover:text-destructive" aria-label="Remove promo code">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo code"
                    className="h-10 rounded-md text-[13px]"
                    aria-label="Promo code"
                  />
                  <Button variant="outline" onClick={applyPromo} className="h-10 shrink-0 rounded-md px-4 text-[13px]">
                    Apply
                  </Button>
                </div>
              )}
            </div>

            <Separator className="my-5" />
            <dl className="space-y-3 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-olive">
                  <dt>Discount ({cart.promoCode})</dt>
                  <dd className="font-medium">−{formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping (standard est.)</dt>
                <dd className="font-medium">{shippingEstimate === 0 ? <span className="text-olive">Free</span> : formatPrice(shippingEstimate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT</dt>
                <dd className="text-muted-foreground">Included</dd>
              </div>
              <Separator />
              <div className="flex justify-between text-[16px]">
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">{formatPrice(money(total))}</dd>
              </div>
            </dl>

            <Link
              href="/checkout"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[14.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Proceed to checkout
            </Link>
            <Link href="/shop" className="mt-3 block text-center text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              or continue shopping
            </Link>

            <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
              {[
                { icon: ShieldCheck, label: 'Secure payments — Stripe ready' },
                { icon: RotateCcw, label: '14-day free returns' },
                { icon: Truck, label: 'Tracked delivery across Europe' },
              ].map((t) => (
                <li key={t.label} className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
                  <t.icon className="h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
