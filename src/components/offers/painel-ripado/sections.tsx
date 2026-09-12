'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Factory, Play, X } from 'lucide-react';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferConfig } from '@/lib/offers/types';
import { PANEL_ASSET_ROOT, PANEL_REVIEWS, PANEL_REVIEW_THUMBS } from './data';

function Stars({ value = 5, size = 13 }: { value?: number; size?: number }) {
  return <span className="inline-flex gap-0.5">{[1,2,3,4,5].map((star) => <span key={star} style={{ color: '#f2b01e', fontSize: size }}>{star <= Math.round(value) ? '★' : '☆'}</span>)}</span>;
}

export function PanelCampaignStory() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) element.play().then(() => setPlaying(true)).catch(() => undefined);
    else { element.pause(); setPlaying(false); }
  };

  return <>
    <section id="preco-fabrica" className="bg-[#201a17] px-4 py-14 text-[#f7f3ef] sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="max-w-2xl">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#c79a68]"><Factory className="h-4 w-4" />E-com.casa · oferta direta online</p>
          <h2 className="font-display text-4xl font-normal leading-[1.08] sm:text-6xl">Do catálogo.<span className="block text-[#d4aa7b]">Para a sua casa.</span></h2>
          <p className="mt-5 text-[15px] leading-7 text-[#cbbbaf]"><strong className="text-white">Uma campanha dedicada ao produto.</strong> Cor, medida, inspiração e checkout reunidos num único percurso de compra.</p>
          <div className="relative mt-5 aspect-video max-w-[520px] overflow-hidden rounded-[22px] bg-[#15110f]">
            <video ref={video} src={`${PANEL_ASSET_ROOT}/videos/nuralta-hist.mp4`} poster={`${PANEL_ASSET_ROOT}/videos/nuralta-hist-poster.webp`} loop playsInline preload="metadata" className="h-full w-full object-cover" onClick={toggle} />
            <button type="button" onClick={toggle} aria-label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'} className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#201a17]/70 text-white"><Play className="h-5 w-5" fill="currentColor" /></button>
          </div>
          <p className="mt-5 text-[15px] leading-7 text-[#f7f3ef]">O preço e as opções apresentados correspondem ao catálogo ODEM. Quando existir uma promoção, o prazo e as condições são indicados junto ao preço.</p>
        </div>
        <a href="#configurar-painel" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#c79a68] px-5 text-sm font-bold text-[#201a17]">Escolher cor e tamanho<ArrowRight className="h-4 w-4" /></a>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div><p className="mb-3 text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Textura, ritmo, calor</p><h2 className="font-display text-4xl leading-tight">Um detalhe que muda a forma de sentir o espaço.</h2><p className="mt-5 leading-relaxed text-[#5c5049]">Crie uma parede com presença, textura e calor natural. O Painel Ripado Decorativo foi pensado para renovar salas, quartos, escritórios e espaços comerciais.</p><ul className="mt-6 space-y-2 text-sm text-[#3d342e]"><li>Transforma o ambiente rapidamente</li><li>Ritmo visual moderno e acolhedor</li><li>Instalação simples e acabamento elegante</li><li>Manutenção fácil no dia a dia</li></ul></div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg"><img src={`${PANEL_ASSET_ROOT}/images/gallery/walnut/img2.webp`} alt="Ambiente com acabamento Nogueira" className="h-full w-full object-cover" /></div>
      </div>
    </section>
  </>;
}

export function PanelProductDetails({ product }: { product: CatalogProduct }) {
  const [open, setOpen] = useState(0);
  const groups = [
    { number:'01', title:'Medidas e cobertura', subtitle:'Dimensões, área e peso', rows:[['Dimensões',product.dimensions || 'Consultar ficha do produto'],['Área por painel','1,62 m² (600 × 2700 mm)'],['Espessura / formato',product.dimensions || 'Consultar ficha do produto'],['Peso',product.weight || 'Varia consoante a medida']] },
    { number:'02', title:'Materiais e acabamento', subtitle:'Composição e presença visual', rows:[['Material',product.materials || 'MDF com revestimento decorativo'],['Acabamento','Mate, conforme a cor escolhida'],['Aplicação','Paredes interiores']] },
    { number:'03', title:'Instalação e acessórios', subtitle:'O que recebe e como aplicar', rows:[['Conteúdo','1 painel por unidade'],['Fixação','Método adequado à parede e ao material'],['Superfícies','Sólidas, limpas, secas e niveladas']] },
    { number:'04', title:'Cuidados e pós-venda', subtitle:'Utilização, entrega e devoluções', rows:[['Cuidados',product.care || 'Limpar com pano macio'],['Entrega','Prazo e transportadora confirmados no checkout'],['Devolução','Aplicam-se as condições E-com.casa e direitos legais do consumidor']] },
  ];
  return <section className="bg-[#201a17] px-4 py-16 text-[#f7f3ef] sm:px-6"><div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#c79a68]">Detalhes do produto</p><h2 className="mt-4 font-display text-4xl leading-tight">Tudo o que precisa de saber antes de instalar.</h2></div><div>{groups.map((group,index) => <div key={group.number} className="border-b border-white/15"><button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center gap-4 py-5 text-left"><span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-xs text-[#c79a68]">{group.number}</span><span className="flex-1"><strong className="block text-sm">{group.title}</strong><span className="text-xs text-[#b7a696]">{group.subtitle}</span></span><ChevronDown className={`h-4 w-4 transition ${open === index ? 'rotate-180' : ''}`} /></button>{open === index && <dl className="pb-5">{group.rows.map(([term,value]) => <div key={term} className="grid gap-1 border-t border-white/10 py-3 text-sm sm:grid-cols-[145px_1fr]"><dt className="text-[#b7a696]">{term}</dt><dd>{value}</dd></div>)}</dl>}</div>)}</div></div></section>;
}

export function PanelInspiration() {
  const images = ['gallery/oak/img1.webp','gallery/walnut/img2.webp','gallery/black/img1.webp','gallery/oak/img3.webp','gallery/walnut/img1.webp','gallery/black/img2.webp'];
  return <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><p className="text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Inspiração</p><h2 className="mt-2 font-display text-4xl">Veja o efeito em diferentes ambientes.</h2><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <div key={image} className="aspect-[4/5] overflow-hidden rounded-lg bg-[#ece5dd]"><img src={`${PANEL_ASSET_ROOT}/images/${image}`} alt="Inspiração Painel Ripado" className="h-full w-full object-cover" loading="lazy" /></div>)}</div></section>;
}

export function PanelReviews() {
  const [filter, setFilter] = useState<'all'|'photos'>('all');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const visible = filter === 'photos' ? PANEL_REVIEWS.filter((review) => review.photos.length) : PANEL_REVIEWS;
  return <section id="avaliacoes" className="border-y border-[#e6ded4] bg-[#fdfbf9] py-10" style={{ scrollMarginTop:72 }}>
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <div className="flex items-center justify-between gap-4"><h2 className="text-base font-bold sm:text-lg">Galeria de avaliações</h2><a href="#lista-avaliacoes" className="text-xs text-[#83766d]">Ver todas (36) ›</a></div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{PANEL_REVIEW_THUMBS.map((src,index) => <button key={src} type="button" onClick={() => setLightbox(src)} className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-[#ece5dd] transition hover:scale-105 sm:h-28 sm:w-24"><img src={src} alt={`Imagem de avaliação ${index+1}`} className="h-full w-full object-cover" loading="lazy" /></button>)}</div>
      <div id="lista-avaliacoes" className="mt-5 border-t border-[#e6ded4] pt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Avaliações</h3><span className="text-[11px] font-semibold text-[#4d7d44]">Experiências apresentadas na campanha</span></div><div className="mt-3 flex items-start gap-3"><strong className="text-3xl leading-none">4,7</strong><div><Stars value={4.7} size={16} /><span className="block text-xs text-[#83766d]">220 avaliações</span></div></div>
        <div className="mt-4 flex gap-2 text-[11px]"><button type="button" onClick={() => setFilter('all')} className={`rounded-md px-3 py-2 ${filter === 'all' ? 'bg-[#201a17] text-white' : 'bg-[#f0f2f3]'}`}>todas (220)</button><button type="button" onClick={() => setFilter('photos')} className={`rounded-md px-3 py-2 ${filter === 'photos' ? 'bg-[#201a17] text-white' : 'bg-[#f0f2f3]'}`}>com fotos (22)</button></div>
        <div className="mt-2 divide-y divide-[#ece5dd]">{visible.map((review,index) => <article key={`${review.name}-${index}`} className="py-5"><div className="flex flex-wrap items-center gap-x-3 gap-y-1.5"><Stars /><strong className="text-xs">{review.name}</strong><span className="text-[10px] text-[#8d7f73]">🇵🇹 {review.location} · {review.time}</span></div><h4 className="mt-2 text-sm font-bold">{review.title}</h4><p className="mt-1 text-xs leading-5 text-[#62574f]">{review.body}</p><div className="mt-3 flex gap-2 overflow-x-auto">{review.photos.map((photo,photoIndex) => <button key={photo} type="button" onClick={() => setLightbox(photo)} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-24"><img src={photo} alt={`Foto ${photoIndex+1} de ${review.name}`} className="h-full w-full object-cover" /></button>)}</div></article>)}</div>
        <div className="mt-2 flex justify-between border-t border-[#e6ded4] pt-5 text-xs text-[#83766d]"><span>A mostrar 1–5 de 220</span><span>Página 1 de 44</span></div>
      </div>
    </div>
    {lightbox && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-5" onClick={() => setLightbox(null)}><button type="button" aria-label="Fechar" className="absolute right-5 top-5 text-white"><X /></button><img src={lightbox} alt="Avaliação ampliada" className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain" /></div>}
  </section>;
}

export function PanelFaq({ offer }: { offer: OfferConfig }) {
  const [open,setOpen] = useState(0);
  return <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6"><h2 className="font-display text-4xl">Perguntas frequentes</h2><div className="mt-7 border-t border-[#e0d6cb]">{offer.faqs.map((item,index) => <div key={item.question} className="border-b border-[#e0d6cb]"><button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center gap-4 py-5 text-left"><span className="w-7 text-xs font-bold text-[#a89a8d]">{String(index+1).padStart(2,'0')}</span><strong className="flex-1 text-sm">{item.question}</strong><ChevronDown className={`h-4 w-4 transition ${open === index ? 'rotate-180' : ''}`} /></button>{open === index && <p className="pb-5 pl-11 pr-8 text-sm leading-6 text-[#62574f]">{item.answer}</p>}</div>)}</div></section>;
}

export function PanelFooter() {
  return <footer className="border-t border-[#e0d6cb] bg-[#efe7de] px-4 py-10 text-[#5c5049] sm:px-6"><div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3"><div><strong className="font-display text-xl text-[#201a17]">E-com.casa</strong><p className="mt-2 text-xs leading-5">Make Your Space Yours.<br />Operado por MGJ EXPERT LTD · England & Wales · Company No. 17422467.</p></div><div className="text-xs leading-6"><strong className="text-[#201a17]">Apoio</strong><p>support@e-com.casa<br />+44 7451 214299</p></div><div className="flex flex-col text-xs leading-6"><strong className="text-[#201a17]">Informação legal</strong><Link href="/legal/terms">Termos</Link><Link href="/legal/privacy">Privacidade</Link><Link href="/legal/returns">Devoluções</Link><Link href="/contact">Contacto</Link></div></div></footer>;
}
