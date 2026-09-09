import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, Euro, Info, PackageCheck, Radar } from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_OPTIONS } from '@/lib/constants';
import { formatPrice } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Shipping & Delivery',
  description:
    'Delivery areas, estimates, costs, tracking and what to do if your order arrives damaged or goes missing.',
  alternates: { canonical: '/shipping' },
};

const SUMMARY = [
  {
    icon: Clock,
    title: SHIPPING_OPTIONS[0].description,
    label: 'Standard delivery',
    sub: `from dispatch`,
  },
  {
    icon: Radar,
    title: SHIPPING_OPTIONS[1].description,
    label: 'Express delivery',
    sub: `where available`,
  },
  {
    icon: Euro,
    title: `Free standard over ${formatPrice(FREE_SHIPPING_THRESHOLD)}`,
    label: 'Free shipping threshold',
    sub: 'automatically applied at checkout',
  },
  {
    icon: PackageCheck,
    title: 'Tracking link by email',
    label: 'Every order',
    sub: 'as soon as it is dispatched',
  },
];

export default function ShippingPage() {
  return (
    <>
      {/* Hero */}
      <div className="relative h-[280px] w-full overflow-hidden bg-ink md:h-[340px]">
        <Image
          src="/images/space-balcony.jpg"
          alt="Cozy balcony with deck tiles, bistro chair and potted plants"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/55" aria-hidden="true" />
        <div className="container-ecom absolute inset-0 flex flex-col items-center justify-center text-center">
          <nav aria-label="Breadcrumb" className="text-xs text-white/70">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Shipping</li>
            </ol>
          </nav>
          <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-white md:text-4xl">
            Shipping &amp; Delivery
          </h1>
        </div>
      </div>

      {/* Summary cards */}
      <section className="container-ecom pt-12 lg:pt-16" aria-label="Delivery at a glance">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUMMARY.map((card) => (
            <li key={card.label} className="rounded-md border border-border bg-card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                <card.icon className="h-4.5 w-4.5 text-olive" strokeWidth={1.5} />
              </span>
              <p className="font-display mt-3.5 text-[17px] font-medium leading-snug">{card.title}</p>
              <p className="mt-1 text-[12.5px] font-medium text-muted-foreground">{card.label}</p>
              <p className="text-[12px] text-muted-foreground/80">{card.sub}</p>
            </li>
          ))}
        </ul>

        {/* Placeholder configuration notice */}
        <div className="mt-8 rounded-md border border-border bg-cream p-4 sm:p-5" role="note">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-star" strokeWidth={1.5} />
            <p className="text-[13px] leading-relaxed text-foreground/75">
              <span className="font-medium text-foreground">Draft configuration.</span>{' '}
              FREE_SHIPPING_THRESHOLD and delivery times are placeholders pending logistics configuration. The
              costs and estimates below reflect the current checkout settings and may change before go-live.
            </p>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container-ecom py-12 lg:py-16" aria-label="Shipping details">
        <div className="mx-auto max-w-3xl space-y-10">
          <section aria-labelledby="eu-shipping">
            <h2 id="eu-shipping" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              EU shipping
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              We deliver to consumer addresses across the European markets listed at checkout. Two options are
              available where the destination supports them: standard delivery (3–5 working days from dispatch)
              and express delivery (1–2 working days from dispatch). Working days exclude weekends and public
              holidays. The available options and the exact cost for your address are always confirmed at
              checkout before you pay.
            </p>
          </section>

          <section aria-labelledby="uk-shipping">
            <h2 id="uk-shipping" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              UK shipping
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              We deliver to the United Kingdom. UK delivery times are shown at checkout and follow the same
              standard and express structure where available. Please note that orders crossing a customs border
              can be subject to import VAT, duties and carrier handling fees — see{' '}
              <a href="#customs" className="underline underline-offset-2 hover:text-olive">
                Customs, duties and taxes
              </a>{' '}
              below.
            </p>
          </section>

          <section aria-labelledby="estimates">
            <h2 id="estimates" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Delivery estimates
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              Estimates start from dispatch, not from the moment you place the order:
            </p>
            <ul className="mt-4 space-y-2.5 text-[14.5px] text-foreground/80">
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-olive" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-foreground">Standard delivery:</strong> 3–5 working days
                  from dispatch.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-olive" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-foreground">Express delivery:</strong> 1–2 working days
                  from dispatch, where available.
                </span>
              </li>
            </ul>
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
              During peak periods (campaigns, seasonal holidays) carriers may take slightly longer. Large or
              fragile items travel with specialist carriers and can need extra handling time.
            </p>
          </section>

          <section aria-labelledby="costs">
            <h2 id="costs" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Costs
            </h2>
            <ul className="mt-4 space-y-2.5 text-[14.5px] text-foreground/80">
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-olive" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-foreground">Standard delivery:</strong>{' '}
                  {formatPrice(SHIPPING_OPTIONS[0].price)} per order.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-olive" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-foreground">Express delivery:</strong>{' '}
                  {formatPrice(SHIPPING_OPTIONS[1].price)} per order, where available.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-olive" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-foreground">Free standard shipping</strong> on orders
                  over {formatPrice(FREE_SHIPPING_THRESHOLD)} — applied automatically at checkout.
                </span>
              </li>
            </ul>
          </section>

          <section aria-labelledby="tracking">
            <h2 id="tracking" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Tracking
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              When your parcel is handed to the carrier we send you a confirmation email with a tracking link.
              Tracking events can take a few hours to appear after dispatch. If tracking shows no movement for
              several working days, contact us with your order number and we will follow it up with the carrier.
            </p>
          </section>

          <section aria-labelledby="damaged">
            <h2 id="damaged" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Damaged deliveries
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              If the parcel or the product arrives damaged, note the damage with the carrier where possible and
              keep the packaging. Photograph the box and the affected items, then contact{' '}
              <a href="mailto:support@e-com.casa" className="underline underline-offset-2 hover:text-olive">
                support@e-com.casa
              </a>{' '}
              with your order number as soon as reasonably possible. We will arrange a replacement or a refund in
              line with your statutory rights — see our{' '}
              <Link href="/returns" className="underline underline-offset-2 hover:text-olive">
                Returns page
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="missing">
            <h2 id="missing" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Missing deliveries
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              If tracking says “delivered” but the parcel is not with you, please first check with neighbours,
              household members and any collection notice the carrier may have left. If the parcel still cannot
              be located, contact us with your order number and we will open an investigation with the carrier on
              your behalf.
            </p>
          </section>

          <section id="customs" aria-labelledby="customs" className="scroll-mt-24">
            <h2 id="customs" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Customs, duties and taxes
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              Product prices are displayed with VAT included for EU consumer sales. For deliveries outside the EU
              customs area — for example to the UK — import VAT, customs duties and carrier handling fees may
              apply. These charges are set by the relevant authorities and, where applicable, are payable by the
              recipient. The final configuration for UK VAT treatment at checkout is still being completed.
            </p>
          </section>

          <section aria-labelledby="remote-areas">
            <h2 id="remote-areas" className="font-display text-xl font-medium tracking-tight sm:text-2xl">
              Remote areas
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
              Deliveries to islands, mountainous regions and other remote areas may take longer than the standard
              estimates or carry a surcharge. Where this applies, it is shown at checkout before you pay.
            </p>
          </section>

          <div className="rounded-md border border-border bg-card p-6">
            <p className="text-[14.5px] leading-relaxed text-foreground/80">
              Questions about a delivery in progress? Our customer care team is happy to help.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="group inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-[13.5px] font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                Contact us
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
              </Link>
              <Link
                href="/legal/shipping"
                className="inline-flex h-10 items-center rounded-md border border-input bg-background px-5 text-[13.5px] font-medium transition-colors hover:bg-accent"
              >
                Shipping Policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
