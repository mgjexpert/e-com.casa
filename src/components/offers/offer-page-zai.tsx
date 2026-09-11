'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Maximize2,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { OfferBuyBoxV3 } from './offer-buy-box-v3';
import { OfferMarketHeader } from './offer-market-header';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferConfig, OfferMarketContext } from '@/lib/offers/types';
import { cn } from '@/lib/utils';

function dedupe(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function Stars({ rating = 5 }: { rating?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          viewBox="0 0 20 20"
          className="h-[15px] w-[15px]"
          fill={value <= Math.round(rating) ? '#b8860b' : 'none'}
          stroke="#b8860b"
          strokeWidth="1.25"
        >
          <path d="M10 1.8l2.35 4.9 5.15.68-3.8 3.62.95 5.2L10 13.7l-4.65 2.5.95-5.2L2.5 7.38l5.15-.68L10 1.8z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

function AccordionBlock({
  number,
  title,
  subtitle,
  rows,
  defaultOpen = false,
}: {
  number: string;
  title: string;
  subtitle: string;
  rows: Array<[string, string]>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[#ddd3c8] last:border-b">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 py-5 text-left sm:py-6"
        aria-expanded={open}
      >
        <span className="w-8 shrink-0 text-xs font-bold tabular-nums text-[#a89a8d]">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[#201a17]">{title}</span>
          <span className="mt-0.5 block text-xs text-[#7d6f64]">{subtitle}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#7d6f64] transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', open ? 'grid-rows-[1fr] pb-6 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <dl className="rounded-lg border border-[#e2d8ce] bg-[#fdfbf9] px-4 sm:px-5">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b border-[#e8dfd6] py-3.5 last:border-0 sm:grid-cols-[170px_1fr] sm:gap-6">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#8a7d72]">{label}</dt>
                <dd className="text-[12.5px] leading-6 text-[#4f453f]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

function FAQ({ offer }: { offer: OfferConfig }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-t border-[#ddd3c8]">
      {offer.faqs.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question} className="border-b border-[#ddd3c8]">
            <button
              type="button"
              onClick={() => {
                setOpen(expanded ? null : index);
                if (!expanded) trackOfferEvent('faq_open', { offerSlug: offer.slug, faq: item.question });
              }}
              className="flex w-full items-center gap-4 py-5 text-left"
              aria-expanded={expanded}
            >
              <span className="w-7 shrink-0 text-xs font-bold tabular-nums text-[#a89a8d]">{String(index + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[13.5px] font-semibold text-[#201a17] sm:text-[14px]">{item.question}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#7d6f64] transition-transform', expanded && 'rotate-180')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', expanded ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden pl-11 pr-8">
                <p className="max-w-3xl text-[12.5px] leading-6 text-[#6f635b]">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OfferPageZAI({ offer, product, market }: { offer: OfferConfig; product: CatalogProduct; market: OfferMarketContext }) {
  const buyRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stickyVisible, setStickyVisible] = useState(false);
  const saleable = isCatalogProductSaleable(product);
  const reviewsVerified = offer.reviews.mode === 'verified' && Boolean(offer.reviews.count);

  const gallery = useMemo(
    () =>
      dedupe([
        product.image,
        product.hoverImage,
        ...(product.gallery ? product.gallery.split(',').map((item) => item.trim()) : []),
        ...(offer.inspirationImages ?? []),
        '/images/collection-wall-makeover.jpg',
        '/images/journal-wall-transform.jpg',
      ]),
    [offer.inspirationImages, product.gallery, product.hoverImage, product.image],
  );

  const displayTitle = offer.slug === 'painel-ripado' ? 'Painel Ripado Decorativo' : product.name;
  const displayTagline = offer.slug === 'painel-ripado' ? 'Design que transforma. Instalação que simplifica.' : product.shortDescription;
  const activeImage = gallery[activeIndex] ?? product.image;

  useEffect(() => {
    captureOfferAttribution(offer.slug);
    trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode, locale: market.locale });
    trackOfferEvent('product_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode });
  }, [market.countryCode, market.locale, offer.slug, product.slug]);

  useEffect(() => {
    const target = buyRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0.05 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const go = (direction: number) => {
    if (!gallery.length) return;
    setActiveIndex((index) => (index + direction + gallery.length) % gallery.length);
  };

  const scrollToBuy = () => buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const technical = [
    {
      number: '01',
      title: 'Medidas e cobertura',
      subtitle: 'Dimensões, área e planeamento',
      rows: [
        ['Dimensões', product.dimensions || 'Confirmar na variante selecionada'],
        ['Formato', 'Painel decorativo vertical para aplicação em paredes interiores'],
        ['Peso', product.weight || 'Confirmar na ficha comercial do produto'],
        ['Planeamento', 'Meça largura e altura da parede e considere cortes, remates e margem de segurança'],
      ] as Array<[string, string]>,
    },
    {
      number: '02',
      title: 'Materiais e acabamento',
      subtitle: 'Composição e presença visual',
      rows: [
        ['Materiais', product.materials || 'Conforme ficha do produto no catálogo'],
        ['Acabamento', product.color || 'Conforme variante selecionada'],
        ['Textura', 'Ritmo vertical pensado para acrescentar profundidade e contraste à parede'],
        ['Acústica', 'Não é apresentada classificação acústica certificada sem documentação técnica específica'],
      ] as Array<[string, string]>,
    },
    {
      number: '03',
      title: 'Instalação e acessórios',
      subtitle: 'Preparação e aplicação',
      rows: [
        ['Superfície', 'Parede interior sólida, limpa, seca e nivelada'],
        ['Fixação', 'Utilize o método compatível com a parede e com a documentação fornecida com o produto'],
        ['Corte', 'Planeie todos os cortes antes da aplicação e utilize ferramenta adequada ao material'],
        ['Acessórios', 'Consumíveis e fixações só estão incluídos quando explicitamente indicados no produto'],
      ] as Array<[string, string]>,
    },
    {
      number: '04',
      title: 'Cuidados e pós-venda',
      subtitle: 'Utilização, manutenção e apoio',
      rows: [
        ['Cuidados', product.care || 'Limpar com pano macio e seguir a documentação do produto'],
        ['Utilização', 'Interior, salvo indicação técnica expressa em contrário'],
        ['Entrega', 'Prazo, transportadora e custo final são apresentados durante a encomenda'],
        ['Devolução', 'Aplicam-se as condições de devolução e os direitos do consumidor publicados pela E-com.casa'],
      ] as Array<[string, string]>,
    },
  ];

  return (
    <article className="overflow-hidden bg-[#f7f3ef] text-[#201a17]">
      <div className="bg-[#201a17] px-4 py-2.5 text-center text-[10.5px] font-medium tracking-[0.025em] text-[#f7f3ef] sm:text-[11.5px]">
        {offer.announcement}
      </div>
      <OfferMarketHeader market={market} />

      <section id="product" className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:py-11">
        <div className="grid gap-9 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[#e0d6cb] bg-[#e8e0d7] sm:aspect-square">
              <Image src={activeImage} alt={displayTitle} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
              {gallery.length > 1 && (
                <>
                  <button type="button" aria-label="Imagem anterior" onClick={() => go(-1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#201a17] shadow-sm transition hover:bg-white">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Próxima imagem" onClick={() => go(1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#201a17] shadow-sm transition hover:bg-white">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-[#201a17]/80 px-3 py-1.5 text-[10px] uppercase tracking-[.12em] text-[#f2e9df]">E-com.casa</span>
              <span className="absolute bottom-3 left-3 rounded bg-[#201a17]/80 px-2.5 py-1.5 text-[10px] text-[#f2e9df]">{activeIndex + 1} / {Math.max(1, gallery.length)}</span>
              <button type="button" onClick={() => window.open(activeImage, '_blank', 'noopener,noreferrer')} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#201a17] shadow">
                <Maximize2 className="h-3.5 w-3.5" />Ampliar
              </button>
            </div>
            {gallery.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {gallery.map((image, index) => (
                  <button key={`${image}-${index}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Ver imagem ${index + 1}`} className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition', index === activeIndex ? 'border-[#8a5a2b] opacity-100' : 'border-transparent opacity-60 hover:opacity-100')}>
                    <Image src={image} alt="" fill sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={buyRef} className="flex flex-col gap-6">
            <div>
              <h1 className="font-display text-3xl leading-none sm:text-5xl">{displayTitle}</h1>
              <p className="mt-3 text-base leading-relaxed text-[#5c5049]">{displayTagline}</p>
            </div>

            <button type="button" onClick={() => document.getElementById('avaliacoes')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-fit items-center gap-2 text-left" onMouseDown={() => trackOfferEvent('review_interaction', { offerSlug: offer.slug })}>
              {reviewsVerified ? (
                <>
                  <Stars rating={offer.reviews.rating ?? 5} />
                  <strong className="text-sm">{(offer.reviews.rating ?? 5).toFixed(1).replace('.', ',')}</strong>
                  <span className="text-sm text-[#7d6f64] underline decoration-[#d8cec2] underline-offset-4">{offer.reviews.count} avaliações</span>
                </>
              ) : (
                <span className="text-xs font-medium text-[#7d6f64]">Avaliações verificadas serão publicadas aqui quando disponíveis.</span>
              )}
            </button>

            <div className="border-t border-[#e6ded4] pt-5">
              <OfferBuyBoxV3 product={product} offerSlug={offer.slug} />
            </div>

            <div className="border-t border-[#e6ded4] pt-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efe7de]"><Truck className="h-4 w-4 text-[#8a5a2b]" /></span>
                <div>
                  <p className="text-sm font-semibold">Entrega acompanhada para {market.countryName}</p>
                  <p className="mt-1 text-xs leading-5 text-[#7d6f64]">Prazo, transportadora e custo final são confirmados no checkout.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e6ded4] pt-4 text-center text-[10.5px] text-[#6f635b]">
                <span className="inline-flex flex-col items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#8a5a2b]" />Pagamento protegido</span>
                <span className="inline-flex flex-col items-center gap-1.5"><PackageCheck className="h-4 w-4 text-[#8a5a2b]" />Encomenda acompanhada</span>
                <span className="inline-flex flex-col items-center gap-1.5"><Headphones className="h-4 w-4 text-[#8a5a2b]" />Apoio pós-venda</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e0d6cb] bg-[#efe7de] py-14 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.17em] text-[#8a5a2b]">Preço transparente</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">Uma oferta dedicada, ligada ao catálogo real.</h2>
          </div>
          <div>
            <p className="text-base font-medium leading-7 text-[#3d342e]">A página comercial pode ser específica para este produto sem criar um segundo catálogo, um segundo carrinho ou um segundo checkout.</p>
            <p className="mt-4 text-[13.5px] leading-7 text-[#71655d]">Preço, variante, disponibilidade e compra continuam a vir da infraestrutura E-com.casa. Assim preservamos a experiência de funil da referência sem inventar origem de fábrica, promoções, transportadoras ou avaliações.</p>
            <button type="button" onClick={scrollToBuy} className="mt-6 rounded-full bg-[#201a17] px-6 py-3 text-xs font-semibold uppercase tracking-[.08em] text-[#f7f3ef] transition hover:bg-[#8a5a2b]">Configurar painel</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.17em] text-[#8a5a2b]">Transformação</p>
            <h2 className="mt-4 font-display text-[36px] leading-[1.08] sm:text-[46px]">Um detalhe que muda a leitura de toda a divisão.</h2>
          </div>
          <div>
            <p className="text-[14px] leading-7 text-[#71655d]">{offer.transformation.body}</p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {offer.benefits.slice(0, 4).map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-2.5 border-t border-[#ded4ca] pt-3 text-[12.5px] leading-5">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#e5eadf]"><Check className="h-2.5 w-2.5 text-[#536047]" /></span>
                  <span><strong className="block text-[#3d342e]">{benefit.title}</strong><span className="text-[#71655d]">{benefit.body}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {[gallery[1] ?? product.image, gallery[2] ?? product.image].map((image, index) => (
            <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#e8e0d7]">
              <Image src={image} alt="Aplicação de painel ripado em ambiente interior" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e0d6cb] bg-[#fdfbf9]">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-7 text-[10.5px] font-semibold uppercase tracking-[.17em] text-[#8a5a2b]">Detalhes do produto</p>
          {technical.map((block, index) => <AccordionBlock key={block.number} {...block} defaultOpen={index === 0} />)}
        </div>
      </section>

      <section className="bg-[#efe7de] py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-display text-[36px] leading-[1.08] sm:text-[46px]">Inspiração para transformar o espaço.</h2>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-[#71655d]">Ambientes editoriais da E-com.casa para perceber escala, textura e possibilidades de aplicação.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[gallery[3] ?? product.image, gallery[4] ?? gallery[1] ?? product.image].map((image, index) => (
              <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#e0d7ce]">
                <Image src={image} alt="Inspiração com painel ripado" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="avaliacoes" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-9 lg:grid-cols-[.34fr_.66fr] lg:gap-16">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.17em] text-[#8a5a2b]">Avaliações</p>
            {reviewsVerified ? (
              <div className="mt-4">
                <div className="flex items-end gap-3"><span className="text-5xl font-semibold tracking-[-.04em]">{(offer.reviews.rating ?? 5).toFixed(1).replace('.', ',')}</span><div className="pb-1"><Stars rating={offer.reviews.rating ?? 5} /><p className="mt-1 text-xs text-[#7d6f64]">{offer.reviews.count} avaliações verificadas</p></div></div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-[#dfd5cb] bg-[#fdfbf9] p-4 text-xs leading-6 text-[#71655d]">
                <strong className="block text-[#3d342e]">Sem avaliações verificadas publicadas</strong>
                Esta área já está preparada para receber avaliações reais sem transformar conteúdo de demonstração em prova social.
              </div>
            )}
          </div>
          <div>
            {reviewsVerified && offer.reviews.reviews?.length ? (
              <div className="divide-y divide-[#ded4ca] border-y border-[#ded4ca]">
                {offer.reviews.reviews.slice(0, 5).map((review, index) => (
                  <article key={`${review.author}-${index}`} className="py-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs"><strong>{review.author}</strong>{review.location && <span className="text-[#7d6f64]">· {review.location}</span>}{review.date && <span className="text-[#9a8d82]">· {review.date}</span>}</div>
                    <div className="mt-2"><Stars rating={review.rating} /></div>
                    <p className="mt-3 text-[12.5px] leading-6 text-[#655950]">{review.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {gallery.slice(0, 5).map((image, index) => (
                  <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-md bg-[#e8e0d7]"><Image src={image} alt="Galeria editorial do produto" fill sizes="160px" className="object-cover" /></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-[#e0d6cb] bg-[#fdfbf9]">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.35fr_.65fr] lg:gap-16">
          <div><p className="text-[10.5px] font-semibold uppercase tracking-[.17em] text-[#8a5a2b]">FAQ</p><h2 className="mt-4 font-display text-[34px] leading-[1.08] sm:text-[42px]">Comprar sem dúvidas.</h2></div>
          <FAQ offer={offer} />
        </div>
      </section>

      {stickyVisible && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d8cec2] bg-[#f7f3ef]/95 p-3 shadow-[0_-8px_28px_rgba(32,26,23,.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{displayTitle}</p><p className="text-[10.5px] text-[#7d6f64]">{saleable ? 'Configurar e comprar' : 'Disponibilidade em validação'}</p></div>
            <button type="button" onClick={scrollToBuy} className="shrink-0 rounded-full bg-[#201a17] px-5 py-3 text-xs font-semibold text-[#f7f3ef]">{saleable ? 'Comprar' : 'Ver oferta'}</button>
          </div>
        </div>
      )}
    </article>
  );
}
