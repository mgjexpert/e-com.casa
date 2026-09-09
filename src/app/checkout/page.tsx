'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CreditCard, Gift, Lock, LoaderCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { formatPrice, toNumber, money } from '@/lib/format';
import {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_OPTIONS,
  PROMO_CODES,
  GIFT_WRAP_PRICE,
  ORDER_NOTES_MAX,
} from '@/lib/constants';

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    address2: '',
    city: '',
    postalCode: '',
    country: 'PT',
    phone: '',
    shippingMethod: 'standard' as 'standard' | 'express',
    paymentMethod: 'card' as 'card' | 'paypal',
    giftWrap: false,
    notes: '',
    marketingOptIn: false,
    termsAccepted: false,
  });

  useEffect(() => setMounted(true), []);

  const subtotal = toNumber(cart.subtotal().toFixed(2));
  const promo = cart.promoCode ? PROMO_CODES[cart.promoCode] : null;
  const discount = promo ? (subtotal * promo.value) / 100 : 0;
  const option = SHIPPING_OPTIONS.find((o) => o.id === form.shippingMethod) ?? SHIPPING_OPTIONS[0];
  const shipping = option.id === 'standard' && subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : option.price;
  const giftWrapFee = form.giftWrap ? GIFT_WRAP_PRICE : 0;
  const total = Math.max(0, subtotal - discount + shipping + giftWrapFee);

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.termsAccepted) {
      toast({ title: 'Please accept the Terms & Conditions', variant: 'destructive' });
      return;
    }
    if (cart.lines.length === 0) {
      toast({ title: 'Your cart is empty', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          address: form.address,
          address2: form.address2 || null,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
          phone: form.phone || null,
          shippingMethod: form.shippingMethod,
          paymentMethod: form.paymentMethod,
          giftWrap: form.giftWrap,
          notes: form.notes.trim() || null,
          promoCode: cart.promoCode,
          items: cart.lines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? 'Order failed. Please review your details.', variant: 'destructive' });
        return;
      }
      cart.clear();
      router.push(`/checkout/success?order=${data.order.orderNumber}`);
    } catch {
      toast({ title: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (mounted && cart.lines.length === 0) {
    return (
      <div className="container-ecom flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
        <h1 className="font-display mt-5 text-[26px] font-medium">Nothing to check out</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Your cart is empty — add something beautiful first.</p>
        <Link href="/shop" className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-7 text-[14px] font-semibold text-primary-foreground">
          Back to shop
        </Link>
      </div>
    );
  }

  const field = (
    name: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    half = false
  ) => (
    <div className={half ? 'sm:col-span-1' : 'sm:col-span-2'}>
      <Label htmlFor={`co-${name}`} className="text-[12.5px] font-medium">
        {label}
      </Label>
      <Input
        id={`co-${name}`}
        required={props.required !== false}
        value={String(form[name] ?? '')}
        onChange={(e) => set(name, e.target.value)}
        className="mt-1.5 h-11 rounded-md"
        {...props}
      />
    </div>
  );

  return (
    <div className="container-ecom py-8 lg:py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[32px]">Checkout</h1>
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Secure SSL checkout
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* Left: details */}
        <div className="space-y-8">
          {/* Contact */}
          <section aria-labelledby="co-contact" className="rounded-lg border border-border bg-card p-6">
            <h2 id="co-contact" className="font-display text-[19px] font-medium">
              1 · Contact
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
            </div>
            <div className="mt-4 flex items-start gap-2.5">
              <Checkbox
                id="co-marketing"
                checked={form.marketingOptIn}
                onCheckedChange={(v) => set('marketingOptIn', v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="co-marketing" className="text-[12.5px] font-normal leading-relaxed text-muted-foreground">
                Keep me inspired — occasional offers and home ideas by email. Optional, and separate from your
                order updates. See our{' '}
                <Link href="/legal/privacy" className="underline underline-offset-2">privacy policy</Link>.
              </Label>
            </div>
          </section>

          {/* Shipping address */}
          <section aria-labelledby="co-address" className="rounded-lg border border-border bg-card p-6">
            <h2 id="co-address" className="font-display text-[19px] font-medium">
              2 · Shipping address
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field('firstName', 'First name', { autoComplete: 'given-name' }, true)}
              {field('lastName', 'Last name', { autoComplete: 'family-name' }, true)}
              {field('address', 'Address', { autoComplete: 'address-line1' })}
              {field('address2', 'Apartment, suite, etc. (optional)', { autoComplete: 'address-line2', required: false })}
              <div>
                <Label htmlFor="co-country" className="text-[12.5px] font-medium">Country/Region</Label>
                <Select value={form.country} onValueChange={(v) => set('country', v)}>
                  <SelectTrigger id="co-country" className="mt-1.5 h-11 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field('postalCode', 'Postal code', { autoComplete: 'postal-code' }, true)}
              {field('city', 'City', { autoComplete: 'address-level2' }, true)}
              {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel', required: false }, true)}
            </div>
          </section>

          {/* Shipping method */}
          <section aria-labelledby="co-shipping" className="rounded-lg border border-border bg-card p-6">
            <h2 id="co-shipping" className="font-display text-[19px] font-medium">
              3 · Delivery
            </h2>
            <RadioGroup
              value={form.shippingMethod}
              onValueChange={(v) => set('shippingMethod', v)}
              className="mt-4 gap-3"
            >
              {SHIPPING_OPTIONS.map((opt) => {
                const free = opt.id === 'standard' && subtotal - discount >= FREE_SHIPPING_THRESHOLD;
                return (
                  <Label
                    key={opt.id}
                    htmlFor={`ship-${opt.id}`}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-border px-4 py-3.5 transition-colors has-[[data-state=checked]]:border-olive has-[[data-state=checked]]:bg-olive/5"
                  >
                    <span className="flex items-center gap-3">
                      <RadioGroupItem value={opt.id} id={`ship-${opt.id}`} />
                      <span>
                        <span className="block text-[13.5px] font-medium">{opt.name}</span>
                        <span className="block text-[12px] text-muted-foreground">{opt.description}</span>
                      </span>
                    </span>
                    <span className="text-[13.5px] font-semibold">{free ? <span className="text-olive">Free</span> : formatPrice(opt.price)}</span>
                  </Label>
                );
              })}
            </RadioGroup>

            {/* Gift wrap */}
            <div
              className={
                form.giftWrap
                  ? 'mt-4 rounded-md border border-terracotta/40 bg-terracotta/5 transition-colors'
                  : 'mt-4 rounded-md border border-border bg-background/50 transition-colors'
              }
            >
              <Label
                htmlFor="co-giftwrap"
                className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3.5"
              >
                <span className="flex items-start gap-3">
                  <Checkbox
                    id="co-giftwrap"
                    checked={form.giftWrap}
                    onCheckedChange={(v) => set('giftWrap', v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                      <Gift
                        className={form.giftWrap ? 'h-4 w-4 text-terracotta' : 'h-4 w-4 text-muted-foreground'}
                        strokeWidth={1.5}
                      />
                      Add gift wrapping
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                      Recycled kraft paper, linen ribbon and a hand-written card — wrapped by our studio team.
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold">+{formatPrice(GIFT_WRAP_PRICE)}</span>
              </Label>
            </div>

            {/* Delivery notes / gift message */}
            <div className="mt-4">
              <Label htmlFor="co-notes" className="text-[12.5px] font-medium">
                Delivery notes{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="co-notes"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value.slice(0, ORDER_NOTES_MAX))}
                rows={3}
                maxLength={ORDER_NOTES_MAX}
                placeholder="Gift message for the card, buzzer code, safe place to leave the parcel…"
                className="mt-1.5 min-h-[84px] rounded-md bg-background"
                aria-describedby="co-notes-counter"
              />
              <p
                id="co-notes-counter"
                className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground"
                aria-hidden
              >
                {form.notes.length}/{ORDER_NOTES_MAX}
              </p>
            </div>
          </section>

          {/* Payment */}
          <section aria-labelledby="co-payment" className="rounded-lg border border-border bg-card p-6">
            <h2 id="co-payment" className="font-display text-[19px] font-medium">
              4 · Payment
            </h2>
            <RadioGroup
              value={form.paymentMethod}
              onValueChange={(v) => set('paymentMethod', v)}
              className="mt-4 gap-3"
            >
              <Label
                htmlFor="pay-card"
                className="flex cursor-pointer items-center justify-between rounded-md border border-border px-4 py-3.5 transition-colors has-[[data-state=checked]]:border-olive has-[[data-state=checked]]:bg-olive/5"
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem value="card" id="pay-card" />
                  <span className="flex items-center gap-2 text-[13.5px] font-medium">
                    <CreditCard className="h-4 w-4" strokeWidth={1.5} /> Card
                  </span>
                </span>
                <span className="text-[11.5px] text-muted-foreground">Visa · Mastercard · Amex</span>
              </Label>
              <Label
                htmlFor="pay-paypal"
                className="flex cursor-pointer items-center justify-between rounded-md border border-border px-4 py-3.5 transition-colors has-[[data-state=checked]]:border-olive has-[[data-state=checked]]:bg-olive/5"
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem value="paypal" id="pay-paypal" />
                  <span className="text-[13.5px] font-medium">PayPal</span>
                </span>
              </Label>
            </RadioGroup>

            {/* Mock payment notice — never collect card data in custom frontend */}
            <div className="mt-4 rounded-md border border-amber-600/25 bg-amber-500/5 px-4 py-3">
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Demo checkout.</strong> This V1 store is integration-ready for
                Stripe: no card details are collected here. In production, payment is handled by Stripe&apos;s
                hosted, PCI-compliant payment element — you would enter card details on Stripe, not on this site.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2.5">
              <Checkbox
                id="co-terms"
                checked={form.termsAccepted}
                onCheckedChange={(v) => set('termsAccepted', v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="co-terms" className="text-[12.5px] font-normal leading-relaxed text-muted-foreground">
                I agree to the{' '}
                <Link href="/legal/terms" className="underline underline-offset-2">Terms &amp; Conditions</Link>,{' '}
                <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link> and confirm
                I have read the{' '}
                <Link href="/legal/returns" className="underline underline-offset-2">withdrawal rights</Link> (14 days).
              </Label>
            </div>
          </section>
        </div>

        {/* Right: summary */}
        <aside aria-label="Order summary" className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-[19px] font-medium">Your order</h2>
            <ul className="mt-4 max-h-72 space-y-4 overflow-y-auto thin-scrollbar pr-1">
              {cart.lines.map((l) => (
                <li key={l.slug} className="flex gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60">
                    <Image src={l.image} alt={l.name} fill sizes="64px" className="object-cover" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10.5px] font-semibold text-cream">
                      {l.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium">{l.name}</p>
                    <p className="text-[12px] text-muted-foreground">{formatPrice(l.price)} each</p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatPrice(toNumber(l.price) * l.quantity)}</p>
                </li>
              ))}
            </ul>
            <Separator className="my-5" />
            <dl className="space-y-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-olive">
                  <dt>Discount ({cart.promoCode})</dt>
                  <dd>−{formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping ({option.name.toLowerCase()})</dt>
                <dd className="font-medium">{shipping === 0 ? <span className="text-olive">Free</span> : formatPrice(shipping)}</dd>
              </div>
              {form.giftWrap && (
                <div className="flex justify-between text-terracotta">
                  <dt className="flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" strokeWidth={1.5} /> Gift wrap
                  </dt>
                  <dd className="font-medium">+{formatPrice(GIFT_WRAP_PRICE)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT</dt>
                <dd className="text-muted-foreground">Included in prices</dd>
              </div>
              <Separator />
              <div className="flex justify-between text-[17px]">
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">{formatPrice(money(total))}</dd>
              </div>
            </dl>
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-[14.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" strokeWidth={2} /> Pay {formatPrice(money(total))}
                </>
              )}
            </button>
            <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-olive" strokeWidth={1.5} />
              Secure payment powered by Stripe
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
