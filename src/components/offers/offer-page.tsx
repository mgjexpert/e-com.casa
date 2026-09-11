'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PackageCheck, RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { OfferBuyBox } from './offer-buy-box';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import type { OfferConfig } from '@/lib/offers/types';
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

function OfferRating({ offer }: { offer: OfferConfig }) {
  const reviews = offer.reviews;
  if (reviews.mode === 'none') return null;
  if (reviews.mode === 'verified' && reviews.rating && reviews.count) {
    return (
      <button type="button" onClick={() => trackOfferEvent('review_interaction', { offerSlug: offer.slug })} className="inline-flex flex-wrap items-center gap-2 text-left">
        <StarRow rating={reviews.rating} />
        <span className="text-[12.5px] font-semibold">{reviews.rating.toFixed(1)} / 5</span>
        <span className="text-[12px] text-muted-foreground">· {reviews.count} avaliações</span>
      </button>
    );
  }
  return (
    <div className="inline-flex flex-wrap items-center gap-2" aria-label="Módulo visual de avaliações em modo de demonstração">
      <StarRow rating={reviews.rating ?? 5} />
      <span className="text-[11.5px] font-medium text-muted-foreground">Avaliações verificadas serão apresentadas aqui</span>
      <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">preview</span>
    </div>
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
              <span className="text-[14px] font-semibold sm:text-[15px]">{item.question}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', expanded ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden">
                <p className="max-w-3xl text-[13.5px] leading-7 text-muted-foreground">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OfferPage({ offer, product }: { offer: OfferConfig; product: CatalogProduct }) {
  const gallery = useMemo(
    () => dedupe([
      product.image,
      product.hoverImage,
      ...(product.gallery ? product.gallery.split(',').map((item) => item.trim()) : []),
      ...(offer.inspirationImages ?? []),
    ]),
    [offer.inspirationImages, product.gallery, product.hoverImage, product.image],
  );
  const [activeImage, setActiveImage] = useState(gallery[0] ?? product.image);
  const buyBoxRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const saleable = isCatalogProductSaleable(product);

  useEffect(() => {
    captureOfferAttribution(offer.slug);
    trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug });
    trackOfferEvent('product_view', { offerSlug: offer.slug, productSlug: product.slug });
  }, [offer.slug, product.slug]);

  useEffect(() => {
    const target = buyBoxRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0.05 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToBuy = () => buyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <article className="overflow-hidden bg-background text-foreground">
      <div className="bg-ink px-4 py-2.5 text-center text-[11px] font-medium tracking-wide text-cream sm:text-[12px]">
        {offer.announcement}
      </div>

      <section className="container-ecom py-8 sm:py-12 lg:py-16">
        <div className="grid gap-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            <div className="relative aspect-[4/4.45] overflow-hidden rounded-2xl bg-muted/40 sm:aspect-[4/3.9] lg:aspect-[4/4.15]">
              <Image
                src={activeImage}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 56vw"
                className="object-cover transition-transform duration-700 hover:scale-[1.015]"
              />
              <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur">
                {offer.eyebrow}
              </span>
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {gallery.slice(0, 5).map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg border bg-muted/30 transition',
                      activeImage === image ? 'border-olive ring-1 ring-olive/30' : 'border-border hover:border-olive/40',
                    )}
                    aria-label={`Ver imagem ${index + 1}`}
                  >
                    <Image src={image} alt="" fill sizes="120px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:pt-2">
            <OfferRating offer={offer} />
            <h1 className="mt-4 max-w-xl font-display text-[38px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[50px] lg:text-[55px]">
              {offer.headline}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-[16px]">{offer.subheadline}</p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-foreground/70">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> Catálogo integrado</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> Variantes sincronizadas</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-olive" /> Checkout E-com.casa</span>
            </div>
            <div ref={buyBoxRef} className="mt-7">
              <OfferBuyBox product={product} offerSlug={offer.slug} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Truck, text: 'Entrega rastreável' },
                { icon: RotateCcw, text: '14 dias para devolver' },
                { icon: ShieldCheck, text: 'Pagamento seguro' },
                { icon: PackageCheck, text: 'Stock validado antes da venda' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 text-[10.5px] leading-tight text-foreground/70">
                  <Icon className="h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-cream/55 py-14 sm:py-20">
        <div className="container-ecom grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">A transformação</p>
          <div>
            <h2 className="font-display text-[32px] font-medium leading-tight tracking-tight sm:text-[42px]">{offer.valueProposition.title}</h2>
            <p className="mt-5 max-w-2xl text-[14.5px] leading-7 text-muted-foreground">{offer.valueProposition.body}</p>
          </div>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted/40">
            <Image src={offer.transformation.image ?? product.hoverImage ?? product.image} alt="Ambiente com o produto aplicado" fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Antes de pensar em trocar tudo</p>
            <h2 className="mt-3 font-display text-[31px] font-medium leading-tight tracking-tight sm:text-[40px]">{offer.transformation.title}</h2>
            <p className="mt-5 text-[14.5px] leading-7 text-muted-foreground">{offer.transformation.body}</p>
          </div>
        </div>
      </section>

      {offer.beforeAfter && (
        <section className="bg-ink py-16 text-cream sm:py-24">
          <div className="container-ecom">
            <h2 className="max-w-2xl font-display text-[32px] font-medium leading-tight sm:text-[42px]">{offer.beforeAfter.title}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                { image: offer.beforeAfter.beforeImage, label: offer.beforeAfter.beforeLabel ?? 'Antes' },
                { image: offer.beforeAfter.afterImage, label: offer.beforeAfter.afterLabel ?? 'Depois' },
              ].map((item) => (
                <div key={item.label} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
                  <Image src={item.image} alt={item.label} fill sizes="50vw" className="object-cover" />
                  <span className="absolute bottom-4 left-4 rounded-full bg-ink/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest backdrop-blur">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-ecom py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Porque funciona</p>
          <h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">Pequena intervenção. Grande diferença visual.</h2>
        </div>
        <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {offer.benefits.map((benefit, index) => (
            <div key={benefit.title} className="bg-background p-6 sm:p-7">
              <span className="font-display text-[24px] text-olive/45">0{index + 1}</span>
              <h3 className="mt-6 text-[15px] font-semibold">{benefit.title}</h3>
              <p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
        <div className="container-ecom grid gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <Sparkles className="h-6 w-6 text-olive" strokeWidth={1.5} />
            <h2 className="mt-5 font-display text-[31px] font-medium leading-tight sm:text-[40px]">{offer.why.title}</h2>
            <p className="mt-5 text-[14px] leading-7 text-muted-foreground">{offer.why.body}</p>
          </div>
          <ul className="space-y-3">
            {offer.why.points.map((point) => (
              <li key={point} className="flex gap-3 rounded-xl border border-border bg-background p-4 text-[13.5px] leading-6">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-olive/10"><Check className="h-3 w-3 text-olive" /></span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Especificações do catálogo</p>
            <h2 className="mt-3 font-display text-[31px] font-medium leading-tight sm:text-[40px]">Detalhes antes de decidir.</h2>
            <p className="mt-4 text-[13.5px] leading-6 text-muted-foreground">Os dados comerciais desta área vêm do produto associado no catálogo, não da configuração da Offer.</p>
          </div>
          <dl className="overflow-hidden rounded-xl border border-border">
            {[
              ['Produto', product.name],
              ['SKU', product.sku],
              ['Materiais', product.materials],
              ['Dimensões', product.dimensions],
              ['Peso', product.weight],
              ['Cor', product.color],
              ['Cuidados', product.care],
              ['Estado', saleable ? 'Disponível para compra' : 'Validação comercial / documental em curso'],
            ].filter((row) => row[1]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-4 border-b border-border px-4 py-3.5 last:border-b-0 sm:grid-cols-[160px_1fr] sm:px-5">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
                <dd className="text-[13px] leading-6 text-foreground/80">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-cream/55 py-16 sm:py-24">
        <div className="container-ecom">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Instalação</p>
            <h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">Planeado para ficar simples do início ao remate.</h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {offer.installation.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border/80 bg-background p-6">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-olive">Passo {index + 1}</span>
                <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {gallery.length > 1 && (
        <section className="container-ecom py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Inspiração</p>
              <h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">Veja a textura de perto e no espaço.</h2>
            </div>
            <Link href={`/product/${product.slug}`} className="text-[12.5px] font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">Ver ficha de produto</Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.slice(0, 6).map((image, index) => (
              <div key={`${image}-${index}`} className={cn('relative overflow-hidden rounded-xl bg-muted/30', index === 0 ? 'aspect-[4/3] sm:col-span-2 lg:col-span-2' : 'aspect-square')}>
                <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-border bg-muted/15 py-16 sm:py-24">
        <div className="container-ecom grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">Prova social</p>
            <h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">A confiança aparece quando os dados também são reais.</h2>
            {offer.reviews.mode === 'verified' && offer.reviews.rating && offer.reviews.count ? (
              <div className="mt-6">
                <StarRow rating={offer.reviews.rating} />
                <p className="mt-2 text-3xl font-semibold tracking-tight">{offer.reviews.rating.toFixed(1)} / 5</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{offer.reviews.count} avaliações verificadas</p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-background/70 p-5">
                <StarRow rating={offer.reviews.rating ?? 5} />
                <p className="mt-3 text-[13px] font-semibold">Estrutura de ratings e reviews pronta.</p>
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{offer.reviews.satisfactionCopy ?? 'Os dados reais entram aqui sem criar AggregateRating ou reviews fictícias.'}</p>
              </div>
            )}
          </div>
          <div>
            {offer.reviews.mode === 'verified' && offer.reviews.reviews?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {offer.reviews.reviews.map((review) => (
                  <blockquote key={`${review.author}-${review.date ?? review.body}`} className="rounded-xl border border-border bg-background p-5">
                    <StarRow rating={review.rating} />
                    <p className="mt-4 text-[13.5px] leading-6">“{review.body}”</p>
                    <footer className="mt-4 text-[11.5px] text-muted-foreground">{review.author}{review.location ? ` · ${review.location}` : ''}{review.verified ? ' · Compra verificada' : ''}</footer>
                  </blockquote>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-background p-5">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="mt-4 h-3 w-full rounded bg-muted/70" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-muted/70" />
                    <div className="mt-5 h-3 w-28 rounded bg-muted/50" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container-ecom py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">FAQ</p>
            <h2 className="mt-3 font-display text-[32px] font-medium leading-tight sm:text-[42px]">Perguntas antes da transformação.</h2>
          </div>
          <FAQ offer={offer} />
        </div>
      </section>

      <section className="bg-olive px-4 py-16 text-center text-cream sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[34px] font-medium leading-tight sm:text-[46px]">{offer.finalCta.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-7 text-cream/75">{offer.finalCta.body}</p>
          <button type="button" onClick={scrollToBuy} className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-cream px-7 text-[13.5px] font-semibold text-ink transition hover:bg-white">
            {offer.finalCta.button}
          </button>
        </div>
      </section>

      <div className={cn('fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/96 p-3 shadow-[0_-10px_35px_rgba(0,0,0,0.08)] backdrop-blur transition-transform md:hidden', stickyVisible ? 'translate-y-0' : 'translate-y-full')}>
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{product.name}</p>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">{saleable ? 'Escolha a variante no topo' : 'Disponibilidade em validação'}</p>
          </div>
          <button type="button" onClick={scrollToBuy} className="h-10 shrink-0 rounded-lg bg-ink px-4 text-[12px] font-semibold text-cream">
            {saleable ? 'Comprar' : 'Ver estado'}
          </button>
        </div>
      </div>
    </article>
  );
}
