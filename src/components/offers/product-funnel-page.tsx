'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useLiveProduct } from '@/hooks/use-live-product';
import { PanelConfigurator } from './painel-ripado/configurator';
import { TopTicker, FloatingHeader } from './painel-ripado/page';
import { PanelFaq, PanelFooter } from './painel-ripado/sections';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import { trackOfferEvent } from '@/lib/offers/analytics';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferConfig, OfferMarketContext } from '@/lib/offers/types';
export function ProductFunnelPage({ product: initial, offer, market }: { product: CatalogProduct; offer: OfferConfig; market: OfferMarketContext }) {
  const product = useLiveProduct(initial);
  const images = [...new Set([product.image, ...product.gallery.split(',').filter(Boolean)])];
  useEffect(() => { captureOfferAttribution(offer.slug); trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode }); }, [offer.slug, product.slug, market.countryCode]);
  return <main id="top" className="min-h-screen bg-[#f7f3ef] pb-20 text-[#201a17] sm:pb-0">
    <TopTicker /><FloatingHeader />
    <div className="mx-auto flex max-w-6xl justify-between px-4 pt-5 text-xs sm:px-6"><Link href="/offers" className="underline">← Todas as ofertas</Link><Link href={`/product/${product.slug}`} className="underline">Ver no catálogo</Link></div>
    <PanelConfigurator product={product} offerSlug={offer.slug} />
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
      <div><p className="text-xs uppercase tracking-widest text-[#8a5a2b]">{product.manufacturer}</p><h2 className="mt-3 font-display text-3xl">Do catálogo. Para a sua casa.</h2><p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#675b53]">{product.description}</p></div>
      <div className="space-y-3">{[
        ['Dimensões e formato', product.dimensions || 'Consulte a opção selecionada'],
        ['Materiais e acabamento', [product.materials, product.color].filter(Boolean).join(' · ') || 'Consulte a descrição do produto'],
        ['Instalação e acessórios', 'Confirme a superfície e o método de fixação nas instruções do fabricante. Pode adicionar acessórios à encomenda no carrinho.'],
        ['Cuidados e entrega', product.care || 'Siga as instruções do fabricante. Fabricação direta, com acompanhamento da encomenda.'],
      ].map(([title, body],i) => <details key={title} open={i===0} className="rounded-xl border border-[#ddd3c8] bg-white/60 p-5"><summary className="cursor-pointer font-semibold">{title}</summary><p className="mt-3 text-sm leading-6 text-[#675b53]">{body}</p></details>)}</div>
    </section>
    {images.length > 1 && <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><h2 className="mb-6 font-display text-3xl">Veja os detalhes.</h2><div className="flex snap-x gap-4 overflow-x-auto pb-4">{images.slice(1,7).map(src => <div key={src} className="relative aspect-square w-72 shrink-0 snap-start overflow-hidden rounded-xl"><Image src={src} alt={product.name} fill sizes="288px" className="object-cover" /></div>)}</div></section>}
    <PanelFaq offer={offer} /><PanelFooter />
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-[#f7f3ef]/95 px-4 py-3 backdrop-blur sm:hidden"><div><span className="block text-[10px]">{product.promoDiscountPct ? 'Oferta desde' : 'Preço atual'}</span><strong>{(product.priceCents/100).toFixed(2).replace('.',',')} €</strong></div><a href="#configurar-painel" className="rounded-full bg-[#201a17] px-6 py-3 text-sm font-semibold text-white">Escolher e comprar</a></div>
  </main>;
}
