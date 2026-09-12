'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Factory, Headphones, ShieldCheck, Truck } from 'lucide-react';
import { useLiveProduct } from '@/hooks/use-live-product';
import { PanelConfigurator } from './painel-ripado/configurator';
import { TopTicker, FloatingHeader } from './painel-ripado/page';
import { PanelFaq, PanelFooter } from './painel-ripado/sections';
import { campaignEuro } from './painel-ripado/data';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferConfig, OfferMarketContext, OfferReviewItem } from '@/lib/offers/types';

type DetailRow = [string, string];
type DetailGroup = {
  number: string;
  title: string;
  subtitle: string;
  rows: DetailRow[];
};

function uniqueImages(product: CatalogProduct, offer: OfferConfig): string[] {
  return [...new Set([
    product.image,
    ...product.gallery.split(',').map((value) => value.trim()).filter(Boolean),
    ...(offer.inspirationImages ?? []),
    offer.transformation.image ?? '',
  ].filter(Boolean))];
}

function Stars({ value = 5, size = 14 }: { value?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value.toFixed(1)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} style={{ color: '#f2b01e', fontSize: size }}>
          {star <= Math.round(value) ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

function OfferBrandStory({ product, offer, image }: { product: CatalogProduct; offer: OfferConfig; image: string }) {
  const manufacturer = product.manufacturer || product.brand || 'E-com.casa';
  return (
    <section id="preco-fabrica" className="bg-[#201a17] px-4 py-14 text-[#f7f3ef] sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-16">
        <div>
          <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#c79a68]">
            <Factory className="h-4 w-4" />{manufacturer} · seleção E-com.casa
          </p>
          <h2 className="font-display text-4xl font-normal leading-[1.08] sm:text-6xl">
            {offer.valueProposition.title}
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#cbbbaf]">{offer.valueProposition.body}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {offer.benefits.slice(0, 4).map((benefit) => (
              <div key={benefit.title} className="border-t border-white/15 pt-3">
                <strong className="text-sm text-white">{benefit.title}</strong>
                <p className="mt-1 text-xs leading-5 text-[#bfaea1]">{benefit.body}</p>
              </div>
            ))}
          </div>
          <a href="#configurar-painel" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#c79a68] px-5 text-sm font-bold text-[#201a17]">
            Escolher opção e quantidade <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="overflow-hidden rounded-[24px] bg-[#15110f]">
          <img src={image} alt={`${product.name} — detalhe`} className="aspect-[4/5] h-full w-full object-cover" loading="lazy" />
        </div>
      </div>
    </section>
  );
}

function OfferTransformation({ product, offer, image }: { product: CatalogProduct; offer: OfferConfig; image: string }) {
  return (
    <section id="transformation" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">{offer.eyebrow}</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">{offer.transformation.title}</h2>
          <p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-[#5c5049]">{offer.transformation.body}</p>
          <ul className="mt-7 space-y-3 text-sm text-[#3d342e]">
            {offer.why.points.slice(0, 4).map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eadfd3] text-[#7b4f29]"><Check className="h-3 w-3" /></span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#e8e0d7]">
          <img src={image} alt={`${product.name} — ambiente`} className="h-full w-full object-cover" loading="lazy" />
        </div>
      </div>
    </section>
  );
}

function OfferProductDetails({ product, offer }: { product: CatalogProduct; offer: OfferConfig }) {
  const [open, setOpen] = useState(0);
  const installation: DetailRow[] = offer.installation.length
    ? offer.installation.map((step, index): DetailRow => [`${index + 1}. ${step.title}`, step.body])
    : [['Instalação', 'Consulte as instruções do fabricante antes da aplicação.']];
  const groups: DetailGroup[] = [
    {
      number: '01',
      title: 'Medidas e configuração',
      subtitle: 'Dimensões, opções e preço',
      rows: [
        ['Dimensões', product.dimensions || 'Consulte a opção selecionada'],
        ['Opções', product.variants.length ? `${product.variants.length} opções disponíveis` : 'Configuração única'],
        ['Peso', product.weight || 'Consultar ficha do produto'],
        ['Preço atual', campaignEuro(product.priceCents)],
      ],
    },
    {
      number: '02',
      title: 'Materiais e acabamento',
      subtitle: 'Composição e identidade do produto',
      rows: [
        ['Fabricante', product.manufacturer || 'Consultar ficha do produto'],
        ['Marca', product.brand || product.manufacturer || 'E-com.casa'],
        ['Materiais', product.materials || 'Consultar descrição do produto'],
        ['Acabamento / cor', product.color || 'Conforme a opção selecionada'],
      ],
    },
    {
      number: '03',
      title: 'Instalação e acessórios',
      subtitle: 'Planeamento e aplicação',
      rows: installation,
    },
    {
      number: '04',
      title: 'Cuidados e pós-venda',
      subtitle: 'Utilização, entrega e devoluções',
      rows: [
        ['Cuidados', product.care || 'Siga as instruções de manutenção do fabricante'],
        ['Entrega', 'Prazo, transportadora e opções finais são confirmados no checkout'],
        ['Pagamento', 'Checkout seguro E-com.casa com preço novamente validado no servidor'],
        ['Devolução', 'Aplicam-se as condições E-com.casa e os direitos legais do consumidor'],
      ],
    },
  ];

  return (
    <section className="bg-[#201a17] px-4 py-16 text-[#f7f3ef] sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-[11px] uppercase tracking-[.18em] text-[#c79a68]">Detalhes do produto</p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Tudo o que precisa de saber antes de comprar.</h2>
          <p className="mt-5 text-sm leading-7 text-[#bfaea1]">{offer.why.body}</p>
        </div>
        <div>
          {groups.map((group, index) => (
            <div key={group.number} className="border-b border-white/15">
              <button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center gap-4 py-5 text-left">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-xs text-[#c79a68]">{group.number}</span>
                <span className="flex-1"><strong className="block text-sm">{group.title}</strong><span className="text-xs text-[#b7a696]">{group.subtitle}</span></span>
                <ChevronDown className={`h-4 w-4 transition ${open === index ? 'rotate-180' : ''}`} />
              </button>
              {open === index && (
                <dl className="pb-5">
                  {group.rows.map(([term, value]) => (
                    <div key={`${group.number}-${term}`} className="grid gap-1 border-t border-white/10 py-3 text-sm sm:grid-cols-[155px_1fr]">
                      <dt className="text-[#b7a696]">{term}</dt><dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OfferInspiration({ product, images }: { product: CatalogProduct; images: string[] }) {
  const display = images.slice(0, 6);
  if (display.length < 2) return null;
  return (
    <section id="inspiration" className="bg-[#efe7de]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Inspiração</p>
        <h2 className="mt-2 font-display text-4xl sm:text-5xl">Veja o efeito em diferentes perspetivas.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7d6f64]">Imagens do produto e do catálogo autorizado do fabricante para comparar acabamento, textura e escala.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {display.map((src, index) => (
            <div key={`${src}-${index}`} className="aspect-[4/5] overflow-hidden rounded-lg bg-[#ded4ca]">
              <img src={src} alt={`${product.name} — imagem ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: OfferReviewItem }) {
  return (
    <article className="border-b border-[#e6ded4] py-5">
      <div className="flex flex-wrap items-center gap-2 text-xs"><Stars value={review.rating} /><strong>{review.author}</strong>{review.location && <span className="text-[#83766d]">· {review.location}</span>}{review.verified && <span className="font-semibold text-[#4d7d44]">Compra verificada</span>}</div>
      <p className="mt-3 text-sm leading-6 text-[#62574f]">{review.body}</p>
      {review.image && <img src={review.image} alt="Imagem da avaliação" className="mt-3 h-28 w-28 rounded-lg object-cover" loading="lazy" />}
    </article>
  );
}

function OfferReviews({ offer }: { offer: OfferConfig }) {
  const reviews = offer.reviews.mode === 'verified' ? (offer.reviews.reviews ?? []) : [];
  if (reviews.length) {
    const rating = offer.reviews.rating ?? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    const count = offer.reviews.count ?? reviews.length;
    return (
      <section id="avaliacoes" className="border-y border-[#e6ded4] bg-[#fdfbf9] py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Avaliações verificadas</p>
          <div className="mt-3 flex items-end gap-3"><strong className="text-4xl">{rating.toFixed(1).replace('.', ',')}</strong><div><Stars value={rating} size={16} /><span className="block text-xs text-[#83766d]">{count} avaliações</span></div></div>
          <div className="mt-5 border-t border-[#e6ded4]">{reviews.slice(0, 5).map((review, index) => <ReviewCard key={`${review.author}-${index}`} review={review} />)}</div>
        </div>
      </section>
    );
  }

  return (
    <section id="avaliacoes" className="border-y border-[#e6ded4] bg-[#fdfbf9] py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[.9fr_1.1fr] md:items-center">
          <div><p className="text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Comprar com confiança</p><h2 className="mt-3 font-display text-4xl">Um percurso de compra simples e acompanhado.</h2><p className="mt-4 text-sm leading-7 text-[#675b53]">As avaliações só são apresentadas como verificadas quando existe uma origem de compra confirmada. Até lá, mantemos esta área focada nas garantias do processo de compra.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e0d6cb] bg-white p-5"><ShieldCheck className="h-5 w-5 text-[#7b4f29]" /><strong className="mt-3 block text-sm">Pagamento protegido</strong><p className="mt-1 text-xs leading-5 text-[#776b62]">O checkout valida novamente produto, variante, campanha e total antes da cobrança.</p></div>
            <div className="rounded-xl border border-[#e0d6cb] bg-white p-5"><Truck className="h-5 w-5 text-[#7b4f29]" /><strong className="mt-3 block text-sm">Entrega acompanhada</strong><p className="mt-1 text-xs leading-5 text-[#776b62]">Prazo e opções de envio são apresentados para o destino selecionado.</p></div>
            <div className="rounded-xl border border-[#e0d6cb] bg-white p-5"><Headphones className="h-5 w-5 text-[#7b4f29]" /><strong className="mt-3 block text-sm">Apoio pós-venda</strong><p className="mt-1 text-xs leading-5 text-[#776b62]">Suporte E-com.casa para entrega, devoluções e acompanhamento da encomenda.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferFinalCta({ offer, product }: { offer: OfferConfig; product: CatalogProduct }) {
  return (
    <section className="bg-[#201a17] px-4 py-14 text-center text-[#f7f3ef] sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#c79a68]">{product.brand || product.manufacturer || 'E-com.casa'}</p>
        <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{offer.finalCta.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#cbbbaf]">{offer.finalCta.body}</p>
        <a href="#configurar-painel" className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-[#f7f3ef] px-7 text-sm font-semibold text-[#201a17]">{offer.finalCta.button}</a>
      </div>
    </section>
  );
}

export function ProductFunnelPage({ product: initial, offer, market }: { product: CatalogProduct; offer: OfferConfig; market: OfferMarketContext }) {
  const product = useLiveProduct(initial);
  const images = useMemo(() => uniqueImages(product, offer), [product, offer]);
  const storyImage = images[1] ?? images[0] ?? product.image;
  const transformationImage = offer.transformation.image ?? images[2] ?? storyImage;

  useEffect(() => {
    captureOfferAttribution(offer.slug);
    trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode, locale: market.locale });
    trackOfferEvent('product_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode });
  }, [offer.slug, product.slug, market.countryCode, market.locale]);

  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-[#f7f3ef] pb-20 text-[#201a17] sm:pb-0">
      <style jsx global>{`
        @keyframes ecomPanelTicker { to { transform: translateX(-50%); } }
        .ecom-panel-ticker { animation: ecomPanelTicker 26s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ecom-panel-ticker { animation: none; } }
      `}</style>
      <TopTicker />
      <FloatingHeader />
      <PanelConfigurator product={product} offerSlug={offer.slug} />
      <OfferBrandStory product={product} offer={offer} image={storyImage} />
      <OfferTransformation product={product} offer={offer} image={transformationImage} />
      <OfferProductDetails product={product} offer={offer} />
      <OfferInspiration product={product} images={images} />
      <OfferReviews offer={offer} />
      <PanelFaq offer={offer} />
      <OfferFinalCta offer={offer} product={product} />
      <PanelFooter />
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#d8cec2] bg-[#f7f3ef]/95 px-4 py-3 shadow-[0_-8px_24px_rgba(32,26,23,.14)] backdrop-blur sm:hidden">
        <div><span className="block text-[10px] text-[#7d6f64]">{product.promoDiscountPct ? `Oferta −${product.promoDiscountPct}%` : 'Preço atual'}</span><strong>{campaignEuro(product.priceCents)}</strong></div>
        <a href="#configurar-painel" className="rounded-full bg-[#201a17] px-6 py-3 text-sm font-semibold text-white">Escolher e comprar</a>
      </div>
    </main>
  );
}
