'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CreditCard, Headphones, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { OfferBuyBoxV3 } from './offer-buy-box-v3';
import { OfferMarketHeader } from './offer-market-header';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { COMPANY } from '@/lib/company';
import type { OfferConfig, OfferMarketContext } from '@/lib/offers/types';
import type { CatalogProduct } from '@/lib/catalog/types';
import { cn } from '@/lib/utils';

const DEMO_REVIEWS = [
  {
    author: 'Cliente E-com.casa',
    location: 'Lisboa',
    date: 'Exemplo de layout',
    title: 'Mudou completamente a parede da sala',
    body: 'O ripado dá profundidade sem tornar o espaço pesado. O resultado visual ficou muito próximo do que procurávamos.',
  },
  {
    author: 'Cliente E-com.casa',
    location: 'Porto',
    date: 'Exemplo de layout',
    title: 'Acabamento muito elegante',
    body: 'Gostámos sobretudo da textura e do contraste com a parede clara. O painel cria um ponto focal sem excessos.',
  },
  {
    author: 'Cliente E-com.casa',
    location: 'Braga',
    date: 'Exemplo de layout',
    title: 'Instalação simples de planear',
    body: 'Medimos a parede com antecedência e a paginação ajudou-nos a perceber a quantidade necessária para o projeto.',
  },
  {
    author: 'Cliente E-com.casa',
    location: 'Coimbra',
    date: 'Exemplo de layout',
    title: 'Boa solução para uma parede de destaque',
    body: 'O padrão vertical alonga visualmente a divisão e funciona muito bem atrás do móvel de TV.',
  },
  {
    author: 'Cliente E-com.casa',
    location: 'Setúbal',
    date: 'Exemplo de layout',
    title: 'Visual quente e contemporâneo',
    body: 'Foi a alteração que mais impacto teve na divisão sem precisarmos de mudar o mobiliário existente.',
  },
] as const;

function dedupe(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function Stars({ rating = 5, size = 'sm' }: { rating?: number; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <svg key={value} viewBox="0 0 20 20" className={size === 'md' ? 'h-[18px] w-[18px]' : 'h-[15px] w-[15px]'} fill={value <= Math.round(rating) ? '#d6a64b' : 'none'} stroke="#d6a64b" strokeWidth="1.25">
          <path d="M10 1.8l2.35 4.9 5.15.68-3.8 3.62.95 5.2L10 13.7l-4.65 2.5.95-5.2L2.5 7.38l5.15-.68L10 1.8z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

function TechnicalBlock({
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
    <div className="border-t border-[#d8d3ca] last:border-b">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-4 py-5 text-left sm:py-6" aria-expanded={open}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#292824] text-[10px] font-semibold text-white">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[#262522]">{title}</span>
          <span className="mt-0.5 block text-[11.5px] text-[#827c72]">{subtitle}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#6e685f] transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', open ? 'grid-rows-[1fr] pb-6 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <dl className="grid gap-0 rounded-[6px] bg-[#f7f4ee] px-4 sm:px-5">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b border-[#e3ded5] py-3.5 last:border-b-0 sm:grid-cols-[170px_1fr] sm:gap-6">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#777168]">{label}</dt>
                <dd className="text-[12.5px] leading-6 text-[#3c3934]">{value}</dd>
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
    <div className="border-t border-[#d8d3ca]">
      {offer.faqs.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question} className="border-b border-[#d8d3ca]">
            <button
              type="button"
              onClick={() => {
                setOpen(expanded ? null : index);
                if (!expanded) trackOfferEvent('faq_open', { offerSlug: offer.slug, faq: item.question });
              }}
              className="flex w-full items-center gap-4 py-5 text-left"
              aria-expanded={expanded}
            >
              <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums text-[#777168]">{String(index + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[13.5px] font-semibold text-[#262522] sm:text-[14px]">{item.question}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#777168] transition-transform', expanded && 'rotate-180')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', expanded ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden pl-11 pr-8">
                <p className="max-w-3xl text-[12.5px] leading-6 text-[#6e685f]">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OfferPageV3({ offer, product, market }: { offer: OfferConfig; product: CatalogProduct; market: OfferMarketContext }) {
  const buyRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const saleable = isCatalogProductSaleable(product);

  const gallery = useMemo(
    () => dedupe([
      product.image,
      product.hoverImage,
      ...(product.gallery ? product.gallery.split(',').map((item) => item.trim()) : []),
      ...(offer.inspirationImages ?? []),
      '/images/collection-wall-makeover.jpg',
      '/images/journal-wall-transform.jpg',
    ]),
    [offer.inspirationImages, product.gallery, product.hoverImage, product.image],
  );

  const reviewRating = offer.reviews.rating ?? 4.7;
  const reviewCount = offer.reviews.count ?? 220;
  const displayTitle = offer.slug === 'painel-ripado' ? 'Painel Ripado Decorativo' : offer.headline;
  const displayTagline = offer.slug === 'painel-ripado' ? 'Design que transforma. Instalação que simplifica.' : offer.subheadline;

  useEffect(() => {
    captureOfferAttribution(offer.slug);
    trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode, locale: market.locale });
    trackOfferEvent('product_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode });
  }, [market.countryCode, market.locale, offer.slug, product.slug]);

  useEffect(() => {
    const target = buyRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0.05 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToBuy = () => buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const technical = [
    {
      number: '01',
      title: 'Medidas e cobertura',
      subtitle: 'Dimensões, área e formato',
      rows: [
        ['Dimensões', product.dimensions || 'Confirmar na opção selecionada'],
        ['Formato', 'Painel ripado vertical para aplicação em paredes interiores'],
        ['Peso', product.weight || 'Varia consoante a configuração; confirmar antes da encomenda'],
        ['Planeamento', 'Meça largura e altura da parede e considere cortes, remates e margem de segurança'],
      ],
    },
    {
      number: '02',
      title: 'Materiais e acabamento',
      subtitle: 'Composição e presença visual',
      rows: [
        ['Materiais', product.materials || 'Conforme ficha de produto do catálogo'],
        ['Acabamento', product.color || 'Acabamento decorativo de aspeto natural'],
        ['Textura', 'Ritmo vertical que acrescenta profundidade e contraste à parede'],
        ['Acústica', 'A geometria ripada pode ajudar a quebrar reflexões; não é apresentada classificação acústica certificada sem documentação específica'],
      ],
    },
    {
      number: '03',
      title: 'Instalação e acessórios',
      subtitle: 'Preparação e aplicação',
      rows: [
        ['Superfície', 'Parede interior sólida, limpa, seca e nivelada'],
        ['Fixação', 'Utilize o método compatível com a parede e com a documentação fornecida com o produto'],
        ['Corte', 'Planeie todos os cortes antes da aplicação e utilize ferramenta adequada ao material'],
        ['Acessórios', 'Consumíveis e elementos de fixação só estão incluídos quando explicitamente indicados no produto'],
      ],
    },
    {
      number: '04',
      title: 'Cuidados e pós-venda',
      subtitle: 'Utilização, manutenção e apoio',
      rows: [
        ['Cuidados', product.care || 'Limpar com pano macio e seguir a documentação do produto'],
        ['Utilização', 'Interior, salvo indicação técnica expressa em contrário'],
        ['Entrega', 'Prazo, transportadora e opções finais são apresentados durante a encomenda'],
        ['Devolução', 'Aplicam-se as condições de devolução e os direitos do consumidor publicados pela E-com.casa'],
      ],
    },
  ];

  return (
    <article className="overflow-hidden bg-[#fffefa] text-[#262522]">
      <div className="bg-[#292824] px-4 py-2.5 text-center text-[10.5px] font-medium tracking-[0.025em] text-white sm:text-[11.5px]">
        {offer.announcement}
      </div>
      <OfferMarketHeader market={market} />

      <section className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.06fr_.94fr] lg:gap-12 xl:gap-16">
          <div>
            <div className="relative aspect-[4/4.5] overflow-hidden rounded-[7px] bg-[#f1eee8] sm:aspect-[4/3.85]">
              <Image src={gallery[activeImage] ?? product.image} alt={displayTitle} fill priority sizes="(max-width:1024px) 100vw, 55vw" className="object-cover" />
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2.5">
                {gallery.slice(0, 5).map((image, index) => (
                  <button key={`${image}-${index}`} type="button" onClick={() => setActiveImage(index)} className={cn('relative aspect-square overflow-hidden rounded-[4px] border bg-[#f1eee8]', activeImage === index ? 'border-[#2b2a26] ring-1 ring-[#2b2a26]' : 'border-[#ddd8cf]')} aria-label={`Imagem ${index + 1}`}>
                    <Image src={image} alt="" fill sizes="120px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:pt-1" ref={buyRef}>
            <button type="button" onClick={() => document.getElementById('avaliacoes')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 text-left" onMouseDown={() => trackOfferEvent('review_interaction', { offerSlug: offer.slug })}>
              <Stars rating={reviewRating} />
              <span className="text-[12px] font-semibold text-[#393732]">{reviewRating.toFixed(1).replace('.', ',')}</span>
              <span className="text-[11.5px] text-[#777168]">{reviewCount} avaliações</span>
            </button>

            <h1 className="mt-4 font-display text-[36px] font-medium leading-[1.04] tracking-[-0.035em] text-[#252420] sm:text-[43px] lg:text-[46px]">{displayTitle}</h1>
            <p className="mt-3 text-[14px] leading-6 text-[#6d675f]">{displayTagline}</p>

            <div className="mt-7 border-t border-[#e0dbd3] pt-6">
              <OfferBuyBoxV3 product={product} offerSlug={offer.slug} />
            </div>

            <div className="mt-6 border-t border-[#e0dbd3] pt-5">
              <div className="flex gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2eee6]"><Truck className="h-4 w-4 text-[#4f5943]" strokeWidth={1.6} /></div>
                <div>
                  <p className="text-[12.5px] font-semibold text-[#292824]">Entrega acompanhada</p>
                  <p className="mt-1 text-[11.5px] leading-5 text-[#777168]">Envio para {market.countryName}. Prazo, transportadora e custo final são confirmados no checkout.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#ece8e1] pt-4 text-center text-[10.5px] text-[#6f695f]">
                <span className="inline-flex flex-col items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#4f5943]" />Pagamento protegido</span>
                <span className="inline-flex flex-col items-center gap-1.5"><PackageCheck className="h-4 w-4 text-[#4f5943]" />Encomenda acompanhada</span>
                <span className="inline-flex flex-col items-center gap-1.5"><Headphones className="h-4 w-4 text-[#4f5943]" />Apoio pós-venda</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#ded9d0] bg-[#f5f1e9] py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1080px] gap-10 px-4 sm:px-6 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:gap-20 lg:px-8">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-[#6d755c]">E-com.casa · seleção para interiores</p>
            <h2 className="mt-4 font-display text-[36px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[45px]">Da nossa seleção.<br />Para a sua casa.</h2>
          </div>
          <div>
            <p className="text-[17px] font-medium leading-7 text-[#302f2b]">Escolhemos produtos capazes de transformar o espaço sem transformar a compra numa obra complicada.</p>
            <p className="mt-4 text-[13.5px] leading-7 text-[#746e65]">Esta offer utiliza o catálogo e a infraestrutura comercial da E-com.casa. A apresentação é dedicada ao produto, enquanto preço transacional, variante, stock e checkout continuam ligados ao sistema central.</p>
            <button type="button" onClick={scrollToBuy} className="mt-6 inline-flex h-11 items-center justify-center rounded-[4px] bg-[#292824] px-5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-white">Escolher acabamento</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[.83fr_1.17fr] lg:gap-20">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-[#6d755c]">Textura, ritmo, calor</p>
            <h2 className="mt-4 font-display text-[34px] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[43px]">Um detalhe que muda a forma de sentir o espaço.</h2>
          </div>
          <div>
            <p className="text-[14px] leading-7 text-[#746e65]">Crie uma parede com presença, textura e profundidade visual. O ripado funciona especialmente bem em salas, quartos, escritórios e zonas de passagem onde uma superfície lisa pede mais caráter.</p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {['Transforma o ambiente rapidamente', 'Ritmo visual moderno e acolhedor', 'Instalação simples de planear', 'Manutenção fácil no dia a dia'].map((item) => (
                <li key={item} className="flex items-start gap-2.5 border-t border-[#ded9d0] pt-3 text-[12.5px] leading-5"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#e8ede1]"><Check className="h-2.5 w-2.5 text-[#536047]" /></span>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-[#efebe4]"><Image src={product.hoverImage ?? gallery[1] ?? product.image} alt="Ambiente com painel ripado" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" /></div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-[#efebe4]"><Image src={gallery[2] ?? '/images/journal-wall-transform.jpg'} alt="Detalhe de painel ripado" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" /></div>
        </div>
      </section>

      <section className="border-y border-[#ded9d0] bg-[#fffefa]">
        <div className="mx-auto max-w-[980px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          {technical.map((block, index) => <TechnicalBlock key={block.number} {...block} defaultOpen={index === 0} />)}
        </div>
      </section>

      <section className="bg-[#f5f1e9] py-16 sm:py-24">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-[35px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[44px]">Espaços que ganharam outra vida.</h2>
            <p className="mt-3 text-[13px] leading-6 text-[#777168]">Ambientes de referência para perceber escala, textura e possibilidades de aplicação.</p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[gallery[1] ?? product.image, gallery[4] ?? '/images/collection-wall-makeover.jpg'].map((image, index) => (
              <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-[#e9e4dc]"><Image src={image} alt="Aplicação do painel em ambiente interior" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" /></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-[32px] font-medium tracking-[-0.02em] sm:text-[40px]">Galeria de avaliações</h2>
          <button type="button" onClick={() => document.getElementById('avaliacoes')?.scrollIntoView({ behavior: 'smooth' })} className="text-[12px] font-semibold text-[#4f5943] underline underline-offset-4">Ver avaliações ›</button>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {gallery.slice(0, 6).map((image, index) => (
            <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-[4px] bg-[#eeeae2]"><Image src={image} alt="Galeria visual do produto" fill sizes="180px" className="object-cover" /></div>
          ))}
        </div>
        {offer.reviews.mode !== 'verified' && <p className="mt-3 text-[10.5px] text-[#8a847b]">A galeria acima utiliza imagens editoriais da E-com.casa. Não é apresentada como conteúdo enviado por compradores.</p>}
      </section>

      <section id="avaliacoes" className="border-y border-[#ded9d0] bg-[#faf8f3] py-16 sm:py-24">
        <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.34fr_.66fr] lg:gap-16">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6d755c]">Avaliações</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-[48px] font-semibold leading-none tracking-[-0.04em]">{reviewRating.toFixed(1).replace('.', ',')}</span>
                <div className="pb-1"><Stars rating={reviewRating} size="md" /><p className="mt-1 text-[11.5px] text-[#777168]">{reviewCount} avaliações</p></div>
              </div>
              <div className="mt-5 space-y-2">
                {[5, 4, 3, 2, 1].map((value) => {
                  const widths = { 5: 82, 4: 13, 3: 3, 2: 1, 1: 1 } as Record<number, number>;
                  return <div key={value} className="grid grid-cols-[12px_1fr_32px] items-center gap-2 text-[10px] text-[#777168]"><span>{value}</span><span className="h-1.5 overflow-hidden rounded-full bg-[#e5e0d8]"><span className="block h-full rounded-full bg-[#d6a64b]" style={{ width: `${widths[value]}%` }} /></span><span>{widths[value]}%</span></div>;
                })}
              </div>
              {offer.reviews.mode !== 'verified' && <div className="mt-6 rounded-[5px] border border-[#ddd8cf] bg-white p-3 text-[10.5px] leading-5 text-[#777168]"><strong className="block text-[#403d37]">Pré-visualização do bloco social</strong>Os cartões abaixo são conteúdo de demonstração e devem ser substituídos por avaliações verificadas antes de serem apresentados como compras reais.</div>}
            </div>

            <div>
              <div className="mb-5 flex gap-2">
                <button type="button" className="rounded-full bg-[#2c2b27] px-4 py-2 text-[10.5px] font-semibold text-white">todas ({reviewCount})</button>
                <button type="button" className="rounded-full border border-[#d8d3ca] bg-white px-4 py-2 text-[10.5px] font-semibold text-[#625d55]">com fotos</button>
              </div>
              <div className="divide-y divide-[#ddd8cf] border-y border-[#ddd8cf]">
                {(offer.reviews.mode === 'verified' && offer.reviews.reviews?.length ? offer.reviews.reviews.map((review) => ({ author: review.author, location: review.location ?? '', date: review.date ?? '', title: '', body: review.body })) : DEMO_REVIEWS).map((review, index) => (
                  <article key={`${review.author}-${index}`} className="py-6 first:pt-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <strong className="font-semibold text-[#302e2a]">{review.author}</strong>
                      {review.location && <span className="text-[#817b72]">· {review.location}</span>}
                      {review.date && <span className="text-[#9a9388]">· {review.date}</span>}
                    </div>
                    <div className="mt-2"><Stars rating={5} /></div>
                    {'title' in review && review.title && <h3 className="mt-3 text-[13.5px] font-semibold text-[#302e2a]">{review.title}</h3>}
                    <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-[#686259]">{review.body}</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-[10.5px] text-[#8a847b]">A mostrar 1–5 de {reviewCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[.38fr_.62fr] lg:gap-20">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6d755c]">Comprar sem dúvidas</p>
            <h2 className="mt-4 font-display text-[34px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[43px]">Antes de decidir, tenha todas as respostas.</h2>
            <p className="mt-4 text-[12.5px] leading-6 text-[#777168]">Reunimos o essencial sobre medidas, instalação, entrega e pós-venda para que escolha com mais segurança.</p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[9.5px] leading-4 text-[#6d675f] lg:grid-cols-1 lg:text-left">
              <span className="flex flex-col items-center gap-1.5 lg:flex-row"><CreditCard className="h-4 w-4 text-[#56604b]" />Pagamento protegido</span>
              <span className="flex flex-col items-center gap-1.5 lg:flex-row"><Truck className="h-4 w-4 text-[#56604b]" />Entrega acompanhada</span>
              <span className="flex flex-col items-center gap-1.5 lg:flex-row"><Headphones className="h-4 w-4 text-[#56604b]" />Apoio após a compra</span>
            </div>
          </div>
          <FAQ offer={offer} />
        </div>
      </section>

      <section className="bg-[#2b2a26] px-4 py-14 text-center text-white sm:py-18">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/60">{COMPANY.brand}</p>
          <h2 className="mt-4 font-display text-[34px] font-medium leading-[1.08] sm:text-[43px]">Dê textura à parede. Mantenha o espaço seu.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[12.5px] leading-6 text-white/65">Escolha o acabamento disponível no catálogo e siga para o checkout E-com.casa quando o produto estiver comercialmente ativo.</p>
          <button type="button" onClick={scrollToBuy} className="mt-7 h-11 rounded-[4px] bg-white px-6 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#292824]">Voltar ao produto</button>
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[10.5px] text-white/55">
            <Link href="/shipping" className="hover:text-white">Envio</Link>
            <Link href="/returns" className="hover:text-white">Trocas e devoluções</Link>
            <Link href="/legal/privacy" className="hover:text-white">Privacidade</Link>
            <Link href="/legal/terms" className="hover:text-white">Termos</Link>
            <Link href="/contact" className="hover:text-white">Contacto</Link>
          </div>
        </div>
      </section>

      <div className={cn('fixed inset-x-0 bottom-0 z-50 border-t border-[#d8d3ca] bg-[#fffefa]/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,.08)] backdrop-blur-md transition-transform md:hidden', stickyVisible ? 'translate-y-0' : 'translate-y-full')}>
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold">{displayTitle}</p><p className="mt-0.5 text-[10px] text-[#777168]">{saleable ? 'Escolha a opção acima' : 'Disponibilidade a confirmar'}</p></div>
          <button type="button" onClick={scrollToBuy} className="h-10 shrink-0 rounded-[4px] bg-[#292824] px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-white">{saleable ? 'Comprar' : 'Ver produto'}</button>
        </div>
      </div>
    </article>
  );
}
