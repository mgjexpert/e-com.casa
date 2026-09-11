'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PackageCheck, RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { OfferBuyBoxV2 } from './offer-buy-box-v2';
import { OfferMediaGallery } from './offer-media-gallery';
import { OfferMarketHeader } from './offer-market-header';
import { WallPanelCalculator } from './wall-panel-calculator';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import { getOfferUICopy } from '@/lib/offers/i18n';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { useLanguage } from '@/lib/language-store';
import type { OfferConfig, OfferLanguage, OfferMarketContext } from '@/lib/offers/types';
import type { CatalogProduct } from '@/lib/catalog/types';
import { cn } from '@/lib/utils';

function dedupe(items: Array<string | null | undefined>): string[] {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function StarRow({ rating = 5, className }: { rating?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg key={value} viewBox="0 0 20 20" className="h-4 w-4" fill={value <= Math.round(rating) ? 'var(--amber-star)' : 'none'} stroke="var(--amber-star)" strokeWidth="1.4">
          <path d="M10 1.8l2.35 4.9 5.15.68-3.8 3.62.95 5.2L10 13.7l-4.65 2.5.95-5.2L2.5 7.38l5.15-.68L10 1.8z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

function FAQ({ offer }: { offer: OfferConfig }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border border-y border-border">
      {offer.faqs.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setOpen(expanded ? null : index);
                if (!expanded) trackOfferEvent('faq_open', { offerSlug: offer.slug, faq: item.question });
              }}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-[14px] font-semibold sm:text-[15px]">{String(index + 1).padStart(2, '0')} · {item.question}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', expanded ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden"><p className="max-w-3xl text-[13.5px] leading-7 text-muted-foreground">{item.answer}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ratingLabel(offer: OfferConfig, lang: OfferLanguage) {
  if (offer.reviews.mode === 'verified') return lang === 'pt' ? 'avaliações verificadas' : 'verified reviews';
  return lang === 'pt' ? 'pré-visualização de avaliações' : 'review layout preview';
}

export function OfferPageV2({
  offer,
  product,
  market,
}: {
  offer: OfferConfig;
  product: CatalogProduct;
  market: OfferMarketContext;
}) {
  const storedLang = useLanguage((state) => state.lang);
  const lang = (['en', 'pt', 'fr', 'de', 'es', 'it', 'nl'].includes(storedLang) ? storedLang : market.language) as OfferLanguage;
  const ui = getOfferUICopy(lang);
  const translated = offer.translations?.[lang];
  const announcement = translated?.announcement ?? offer.announcement;
  const eyebrow = translated?.eyebrow ?? offer.eyebrow;
  const headline = translated?.headline ?? offer.headline;
  const subheadline = translated?.subheadline ?? offer.subheadline;
  const valueProposition = translated?.valueProposition ?? offer.valueProposition;
  const transformation = { ...offer.transformation, ...(translated?.transformation ?? {}) };
  const finalCta = translated?.finalCta ?? offer.finalCta;

  const gallery = useMemo(() => dedupe([
    product.image,
    product.hoverImage,
    ...(product.gallery ? product.gallery.split(',').map((item) => item.trim()) : []),
    ...(offer.inspirationImages ?? []),
  ]), [offer.inspirationImages, product.gallery, product.hoverImage, product.image]);

  const buyBoxRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const saleable = isCatalogProductSaleable(product);

  useEffect(() => {
    captureOfferAttribution(offer.slug);
    trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode, locale: market.locale });
    trackOfferEvent('product_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode });
  }, [market.countryCode, market.locale, offer.slug, product.slug]);

  useEffect(() => {
    const target = buyBoxRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0.05 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToBuy = () => buyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <article className="overflow-hidden bg-background text-foreground">
      <div className="bg-ink px-4 py-2.5 text-center text-[11px] font-medium tracking-wide text-cream sm:text-[12px]">{announcement}</div>
      <OfferMarketHeader market={market} />

      <section className="container-ecom py-8 sm:py-12 lg:py-14">
        <div className="grid gap-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <OfferMediaGallery offer={{ ...offer, eyebrow }} product={product} videoLabel={ui.videoLabel} />

          <div className="lg:pt-2">
            {offer.reviews.mode !== 'none' && (
              <button type="button" onClick={() => trackOfferEvent('review_interaction', { offerSlug: offer.slug })} className="inline-flex flex-wrap items-center gap-2 text-left">
                <StarRow rating={offer.reviews.rating ?? 4.8} />
                <span className="text-[12.5px] font-semibold">{(offer.reviews.rating ?? 4.8).toFixed(1)} / 5</span>
                <span className="text-[12px] text-muted-foreground">· {offer.reviews.count ?? 0} {ratingLabel(offer, lang)}</span>
                {offer.reviews.mode !== 'verified' && <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">preview</span>}
              </button>
            )}

            <h1 className="mt-4 max-w-xl font-display text-[38px] font-medium leading-[1.04] tracking-[-0.035em] sm:text-[50px] lg:text-[55px]">{headline}</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-[16px]">{subheadline}</p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-foreground/70">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> {ui.integratedCatalog}</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> {ui.syncedVariants}</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> {ui.secureCheckout}</span>
            </div>

            <div ref={buyBoxRef} className="mt-7"><OfferBuyBoxV2 product={product} offerSlug={offer.slug} initialLanguage={market.language} /></div>
            <div className="mt-4"><WallPanelCalculator offerSlug={offer.slug} dimensions={product.dimensions} copy={ui} /></div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Truck, text: ui.trackedDelivery },
                { icon: RotateCcw, text: ui.returns },
                { icon: ShieldCheck, text: ui.securePayment },
                { icon: PackageCheck, text: ui.validatedStock },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-[10.5px] leading-tight text-foreground/70"><Icon className="h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} /><span>{text}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-cream/55 py-14 sm:py-18">
        <div className="container-ecom grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">E-com.casa · European retail</p>
            <h2 className="mt-3 font-display text-[29px] font-medium leading-tight sm:text-[36px]">Catálogo central. Checkout único. Operação por mercado.</h2>
          </div>
          <p className="max-w-2xl text-[14px] leading-7 text-muted-foreground">A Offer não cria uma loja paralela: preço, SKU, disponibilidade, carrinho, checkout, XPayments, tracking e regras comerciais continuam ligados à infraestrutura E-com.casa. O país detetado é <strong className="font-semibold text-foreground">{market.countryName}</strong> ({market.countryCode}), com locale <strong className="font-semibold text-foreground">{market.locale}</strong>.</p>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-22">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end lg:gap-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.transformation}</p>
          <div><h2 className="font-display text-[32px] font-medium leading-tight tracking-tight sm:text-[42px]">{valueProposition.title}</h2><p className="mt-5 max-w-2xl text-[14.5px] leading-7 text-muted-foreground">{valueProposition.body}</p></div>
        </div>
      </section>

      <section className="container-ecom pb-16 sm:pb-24">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted/40"><Image src={transformation.image ?? product.hoverImage ?? product.image} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" /></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.beforeEverything}</p><h2 className="mt-3 font-display text-[31px] font-medium leading-tight tracking-tight sm:text-[40px]">{transformation.title}</h2><p className="mt-5 text-[14.5px] leading-7 text-muted-foreground">{transformation.body}</p></div>
        </div>
      </section>

      {offer.media && offer.media.length > 0 && (
        <section className="border-y border-border bg-ink py-16 text-cream sm:py-24">
          <div className="container-ecom">
            <div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e0a03c]">{ui.videoLabel}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">Textura e ambiente também se vendem em movimento.</h2><p className="mt-4 text-[13.5px] leading-6 text-cream/65">{ui.videoReferenceDisclaimer}</p></div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {offer.media.map((media, index) => (
                <figure key={media.src} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <div className="aspect-[4/3] overflow-hidden bg-black/20 sm:aspect-video"><video src={media.src} poster={media.poster} className="h-full w-full object-cover" autoPlay muted loop playsInline controls preload="metadata" onPlay={() => trackOfferEvent('video_play', { offerSlug: offer.slug, videoIndex: index + 1 })} /></div>
                  <figcaption className="p-4 text-[11px] leading-5 text-cream/60"><strong className="block text-[12px] text-cream/90">{media.label ?? ui.videoLabel}</strong>{media.disclaimer}{media.attribution ? ` · ${media.attribution}` : ''}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-ecom py-16 sm:py-24">
        <div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.whyWorks}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">{ui.benefitsTitle}</h2></div>
        <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {offer.benefits.map((benefit, index) => <div key={benefit.title} className="bg-background p-6 sm:p-7"><span className="font-display text-[24px] text-olive/45">0{index + 1}</span><h3 className="mt-6 text-[15px] font-semibold">{benefit.title}</h3><p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">{benefit.body}</p></div>)}
        </div>
      </section>

      <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
        <div className="container-ecom grid gap-10 lg:grid-cols-2 lg:gap-20">
          <div><Sparkles className="h-6 w-6 text-olive" strokeWidth={1.5} /><h2 className="mt-5 font-display text-[31px] font-medium leading-tight sm:text-[40px]">{offer.why.title}</h2><p className="mt-5 text-[14px] leading-7 text-muted-foreground">{offer.why.body}</p></div>
          <ul className="space-y-3">{offer.why.points.map((point) => <li key={point} className="flex gap-3 rounded-xl border border-border bg-background p-4 text-[13.5px] leading-6"><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-olive/10"><Check className="h-3 w-3 text-olive" /></span>{point}</li>)}</ul>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.specsEyebrow}</p><h2 className="mt-3 font-display text-[31px] font-medium leading-tight sm:text-[40px]">{ui.specsTitle}</h2><p className="mt-4 text-[13.5px] leading-6 text-muted-foreground">{ui.specsBody}</p></div>
          <dl className="overflow-hidden rounded-xl border border-border">
            {[
              ['Product', product.name], ['SKU', product.sku], ['Materials', product.materials], ['Dimensions', product.dimensions], ['Weight', product.weight], ['Colour', product.color], ['Care', product.care], ['Market', `${market.countryName} · ${market.locale}`], ['Status', saleable ? 'Available for purchase' : 'Commercial / documentation validation in progress'],
            ].filter((row) => row[1]).map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-4 border-b border-border px-4 py-3.5 last:border-b-0 sm:grid-cols-[160px_1fr] sm:px-5"><dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="text-[13px] leading-6 text-foreground/80">{value}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="bg-cream/55 py-16 sm:py-24">
        <div className="container-ecom"><div className="max-w-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.installation}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">{ui.installationTitle}</h2></div><div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{offer.installation.map((step, index) => <div key={step.title} className="rounded-xl border border-border/80 bg-background p-6"><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-olive">{ui.step} {index + 1}</span><h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3><p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">{step.body}</p></div>)}</div></div>
      </section>

      {gallery.length > 1 && (
        <section className="container-ecom py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.inspiration}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">{ui.inspirationTitle}</h2></div><Link href={`/product/${product.slug}`} className="text-[12.5px] font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">{ui.productPage}</Link></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gallery.slice(0, 6).map((image, index) => <div key={`${image}-${index}`} className={cn('relative overflow-hidden rounded-xl bg-muted/30', index === 0 ? 'aspect-[4/3] sm:col-span-2 lg:col-span-2' : 'aspect-square')}><Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>)}</div>
        </section>
      )}

      <section className="border-y border-border bg-muted/15 py-16 sm:py-24">
        <div className="container-ecom grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.socialProof}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">{ui.socialProofTitle}</h2><div className="mt-6 rounded-xl border border-dashed border-border bg-background/70 p-5"><StarRow rating={offer.reviews.rating ?? 4.8} /><p className="mt-2 text-3xl font-semibold tracking-tight">{(offer.reviews.rating ?? 4.8).toFixed(1)} / 5</p><p className="mt-1 text-[12px] text-muted-foreground">{offer.reviews.count ?? 0} {offer.reviews.mode === 'verified' ? ui.verifiedReviews : ratingLabel(offer, lang)}</p>{offer.reviews.mode !== 'verified' && <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{ui.reviewsPending}</p>}</div></div>
          <div>{offer.reviews.mode === 'verified' && offer.reviews.reviews?.length ? <div className="grid gap-4 sm:grid-cols-2">{offer.reviews.reviews.map((review) => <blockquote key={`${review.author}-${review.date ?? review.body}`} className="rounded-xl border border-border bg-background p-5"><StarRow rating={review.rating} /><p className="mt-4 text-[13.5px] leading-6">“{review.body}”</p><footer className="mt-4 text-[11.5px] text-muted-foreground">{review.author}{review.location ? ` · ${review.location}` : ''}{review.verified ? ' · Verified purchase' : ''}</footer></blockquote>)}</div> : <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-xl border border-border bg-background p-5"><div className="h-4 w-24 rounded bg-muted" /><div className="mt-4 h-3 w-full rounded bg-muted/70" /><div className="mt-2 h-3 w-4/5 rounded bg-muted/70" /><div className="mt-5 h-3 w-28 rounded bg-muted/50" /></div>)}</div>}</div>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-24"><div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">{ui.faq}</p><h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">{ui.faqTitle}</h2></div><FAQ offer={offer} /></div></section>

      <section className="bg-olive px-4 py-16 text-center text-cream sm:py-20"><div className="mx-auto max-w-3xl"><h2 className="font-display text-[34px] font-medium leading-tight sm:text-[46px]">{finalCta.title}</h2><p className="mx-auto mt-4 max-w-2xl text-[14px] leading-7 text-cream/75">{finalCta.body}</p><button type="button" onClick={scrollToBuy} className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-cream px-7 text-[13.5px] font-semibold text-ink transition hover:bg-white">{finalCta.button}</button></div></section>

      <div className={cn('fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/96 p-3 shadow-[0_-10px_35px_rgba(0,0,0,0.08)] backdrop-blur transition-transform md:hidden', stickyVisible ? 'translate-y-0' : 'translate-y-full')}>
        <div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{product.name}</p><p className="mt-0.5 text-[10.5px] text-muted-foreground">{saleable ? ui.chooseTop : ui.availabilityPending}</p></div><button type="button" onClick={scrollToBuy} className="h-10 shrink-0 rounded-lg bg-ink px-4 text-[12px] font-semibold text-cream">{saleable ? ui.buy : ui.status}</button></div>
      </div>
    </article>
  );
}
