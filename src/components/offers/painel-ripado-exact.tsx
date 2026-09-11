'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  House,
  Maximize2,
  Menu,
  Minus,
  PackageSearch,
  Play,
  Plus,
  Ruler,
  ShoppingCart,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { trackOfferEvent } from '@/lib/offers/analytics';
import { captureOfferAttribution } from '@/lib/offers/attribution';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferConfig, OfferMarketContext } from '@/lib/offers/types';

const ASSET = 'https://raw.githubusercontent.com/nexflowx-hub/nuraltainteriores/main/public/pt';
const CAMPAIGN_CODE = 'PAINEL75';

const COLORS = [
  ['Carvalho', `${ASSET}/images/img1.webp`],
  ['Carvalho Claro', `${ASSET}/images/var2.webp`],
  ['Preto', `${ASSET}/images/var3.webp`],
  ['Cinza', `${ASSET}/images/var4.webp`],
  ['Nogueira', `${ASSET}/images/var5.webp`],
  ['Marfim', `${ASSET}/images/var6.webp`],
  ['Grafite', `${ASSET}/images/var7.webp`],
] as const;

const GALLERY = [
  `${ASSET}/images/img2.webp`,
  `${ASSET}/images/video-painel-produto-poster.webp`,
  `${ASSET}/images/img3.webp`,
  `${ASSET}/images/img4.webp`,
  `${ASSET}/images/img5.webp`,
  `${ASSET}/images/img6.webp`,
  `${ASSET}/images/img7.webp`,
  `${ASSET}/images/img8.webp`,
];

const REVIEWS = [
  {
    name: 'João Martins', location: 'Lisboa', time: 'hoje às 06:28', title: 'Muito bom pelo preço que paguei',
    body: 'Paguei 56 € pela quantidade de que precisava para a parede da TV. Antes de encomendar, comparei com duas lojas e opções muito parecidas ficavam bastante mais caras. Pelo preço, superou mesmo as expectativas e o resultado ficou excelente.',
    photos: [`${ASSET}/images/r1.webp`, `${ASSET}/images/review-joao-side-v2.webp`, `${ASSET}/images/review-joao-detail-v2.webp`],
  },
  {
    name: 'Inês Carvalho', location: 'Porto', time: 'ontem', title: 'Bonitos e bem embalados',
    body: 'Chegaram todos direitinhos e com os cantos bem protegidos. Tinha algum receio de escolher a cor pela internet, mas é bastante fiel às fotografias e não tem aquele brilho artificial. Para já, nada a apontar.',
    photos: [`${ASSET}/images/r2.webp`],
  },
  {
    name: 'Marta Ribeiro', location: 'Braga', time: 'anteontem', title: 'Fez uma diferença enorme na sala',
    body: 'Pusemos atrás da TV e o espaço deixou logo de parecer tão vazio. O meu marido tratou da montagem num sábado, sem precisarmos de contratar ninguém. Só aconselho a medir tudo com calma antes do primeiro corte 😅',
    photos: [`${ASSET}/images/r5.webp`, `${ASSET}/images/review-marta-side-v2.webp`, `${ASSET}/images/review-marta-detail-v2.webp`],
  },
  {
    name: 'Tiago Sousa', location: 'Coimbra', time: 'há 4 dias', title: 'Preço excelente comparado com outras lojas',
    body: 'Com a promoção, ficou-me por pouco mais de 50 €. Vi painéis semelhantes noutros sites por quase o dobro e decidi experimentar estes. Nunca tinha feito este tipo de montagem, mas numa tarde ficou pronto e a qualidade surpreendeu-me pela positiva.',
    photos: [`${ASSET}/images/r7.webp`, `${ASSET}/images/review-tiago-detail-v2.webp`],
  },
  {
    name: 'Ana Ferreira', location: 'Setúbal', time: 'há 1 semana', title: 'A entrada parece outra',
    body: 'Colocámos só numa parede do hall para não pesar demasiado e ficou com muito mais pinta. A encomenda chegou sem estragos, os cantos vinham protegidos e recebemos as atualizações do envio até à entrega.',
    photos: [`${ASSET}/images/r9.webp`, `${ASSET}/images/review-ana-side-v2.webp`, `${ASSET}/images/review-ana-detail-v2.webp`],
  },
];

const REVIEW_THUMBS = [
  'r1.webp','review-joao-side-v2.webp','review-joao-detail-v2.webp','r2.webp','r5.webp','review-marta-side-v2.webp','review-marta-detail-v2.webp','r7.webp','review-tiago-detail-v2.webp','r9.webp','review-ana-side-v2.webp','review-ana-detail-v2.webp',
  'reviews/customer-review-01.webp','reviews/customer-review-02.webp','reviews/customer-review-03.webp','reviews/customer-review-04.webp','reviews/customer-review-05.webp','reviews/customer-review-06.webp','reviews/customer-review-07.webp','reviews/customer-review-08.webp','reviews/customer-review-09.webp','reviews/customer-review-10-01.webp','reviews/customer-review-10-02.webp','reviews/customer-review-11-01.webp','reviews/customer-review-11-02.webp','reviews/customer-review-11-03.webp','reviews/customer-review-12.webp','reviews/customer-review-13.webp','reviews/customer-review-14.webp','reviews/customer-review-15.webp','reviews/customer-review-16.webp','reviews/customer-review-17-01.webp','reviews/customer-review-17-02.webp','reviews/customer-review-17-03.webp','reviews/customer-review-17-04.webp',
].map((path) => `${ASSET}/images/${path}`);

function euro(value: number) {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function Stars({ value = 5, size = 14 }: { value?: number; size?: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
    {[1,2,3,4,5].map((star) => <span key={star} style={{ fontSize: size, color: '#f2b01e' }}>{star <= Math.round(value) ? '★' : '☆'}</span>)}
  </span>;
}

function TopTicker() {
  const items = ['Envio gratuito em campanhas selecionadas', 'Pagamento seguro com Cartão · Apple Pay · MB WAY · Multibanco', 'Entrega acompanhada', 'E-com.casa'];
  const group = <div className="flex shrink-0 items-center gap-6 px-3 sm:gap-8 sm:px-4">{items.map((item) => <span key={item} className="flex items-center gap-6 whitespace-nowrap sm:gap-8"><span>{item}</span><span className="opacity-40">◆</span></span>)}</div>;
  return <div className="overflow-hidden bg-[#201a17] py-1 text-[#e9dfd5] sm:py-2"><div className="ecom-offer-ticker flex w-max text-[9px] uppercase tracking-[.12em] sm:text-[11px]">{group}{group}</div></div>;
}

function FloatingHeader() {
  const [visible, setVisible] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const openCart = useCartDrawer((state) => state.open);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 40);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <>
    <div className="fixed inset-x-0 top-0 z-40 transition-all duration-200" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-100%)', visibility: visible ? 'visible' : 'hidden', pointerEvents: visible ? 'auto' : 'none' }}>
      <header className="flex items-center justify-between border-b border-[#e6ded4] bg-[#f7f3ef]/95 px-4 py-2 backdrop-blur">
        <button onClick={() => setDrawer(true)} className="rounded-full p-1.5" aria-label="Abrir menu"><Menu className="h-4 w-4" /></button>
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">E-com.casa</Link>
        <button onClick={openCart} className="rounded-full p-1.5" aria-label="Carrinho"><ShoppingCart className="h-4 w-4" /></button>
      </header>
    </div>
    <div className={`fixed inset-0 z-50 ${drawer ? '' : 'pointer-events-none'}`} aria-hidden={!drawer}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${drawer ? 'opacity-100' : 'opacity-0'}`} onClick={() => setDrawer(false)} />
      <aside className={`absolute left-0 top-0 h-full w-[300px] bg-white shadow-2xl transition-transform ${drawer ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b px-5 py-4"><Link href="/" className="font-display text-xl font-semibold">E-com.casa</Link><button onClick={() => setDrawer(false)}><X className="h-5 w-5" /></button></div>
        <nav className="p-3"><a href="#top" onClick={() => setDrawer(false)} className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm"><House className="h-5 w-5"/>Início</a><Link href="/orders" className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm"><PackageSearch className="h-5 w-5"/>As minhas encomendas</Link></nav>
      </aside>
    </div>
  </>;
}

function ProductConfigurator({ product, offer }: { product: CatalogProduct; offer: OfferConfig }) {
  const router = useRouter();
  const add = useCart((state) => state.add);
  const setPromo = useCart((state) => state.setPromo);
  const openCart = useCartDrawer((state) => state.open);
  const [activeIndex, setActiveIndex] = useState(7);
  const [color, setColor] = useState<number | null>(null);
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.availability !== 'outOfStock')?.id);
  const [qty, setQty] = useState(1);
  const [calculator, setCalculator] = useState(false);
  const [wallWidth, setWallWidth] = useState('');
  const [wallHeight, setWallHeight] = useState('');
  const selected = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const regularCents = product.priceCents + (selected?.priceDeltaCents ?? 0);
  const offerCents = Math.round(regularCents * 0.25);
  const regularPrice = (regularCents / 100).toFixed(2);
  const offerPrice = (offerCents / 100).toFixed(2);
  const estimate = useMemo(() => {
    const w = Number(wallWidth.replace(',', '.')); const h = Number(wallHeight.replace(',', '.'));
    if (!w || !h || !selected) return null;
    const match = selected.name.match(/(\d+)\s*×\s*(\d+)/); if (!match) return null;
    return Math.max(1, Math.ceil((w * h) / (Number(match[1]) * Number(match[2]))));
  }, [wallWidth, wallHeight, selected]);

  const addLine = (goCheckout: boolean) => {
    if (!selected || selected.availability === 'outOfStock') return;
    add({ slug: product.slug, name: product.name, subtitle: `${COLORS[color ?? 0][0]} · ${selected.name}`, price: regularPrice, image: product.image, maxStock: product.stock, variantId: selected.id, variantLabel: `${COLORS[color ?? 0][0]} · ${selected.name}` }, qty);
    setPromo(CAMPAIGN_CODE);
    trackOfferEvent(goCheckout ? 'begin_checkout' : 'add_to_cart', { offerSlug: offer.slug, productSlug: product.slug, variantId: selected.id, quantity: qty, value: (offerCents * qty) / 100, currency: product.currency });
    if (goCheckout) router.push('/checkout'); else openCart();
  };

  return <section id="product" className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:py-11">
    <div className="grid gap-9 lg:grid-cols-2 lg:gap-14">
      <div id="product-gallery" className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[#e0d6cb] bg-[#e8e0d7] sm:aspect-square max-sm:-mx-4 max-sm:aspect-[4/3] max-sm:rounded-none max-sm:border-x-0">
          <img src={GALLERY[activeIndex]} alt="Painel Ripado Decorativo" className="h-full w-full object-cover" />
          <button aria-label="Imagem anterior" onClick={() => setActiveIndex((activeIndex - 1 + GALLERY.length) % GALLERY.length)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"><ChevronLeft className="h-5 w-5"/></button>
          <button aria-label="Próxima imagem" onClick={() => setActiveIndex((activeIndex + 1) % GALLERY.length)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow"><ChevronRight className="h-5 w-5"/></button>
          <span className="absolute left-3 top-3 rounded-full bg-[#201a17]/80 px-3 py-1.5 text-[10px] uppercase tracking-[.12em] text-[#f2e9df]">Escolha uma cor</span>
          <span className="absolute bottom-3 left-3 rounded bg-[#201a17]/80 px-2.5 py-1.5 text-[10px] text-[#f2e9df]">{activeIndex + 1} / {GALLERY.length}</span>
          <button onClick={() => window.open(GALLERY[activeIndex], '_blank', 'noopener,noreferrer')} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded bg-white/90 px-3 py-2 text-[10px] font-semibold shadow"><Maximize2 className="h-3.5 w-3.5"/>Ampliar</button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 max-sm:hidden">{GALLERY.map((src, i) => <button key={src} onClick={() => setActiveIndex(i)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === activeIndex ? 'border-[#8a5a2b]' : 'border-transparent opacity-60'}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>)}</div>
      </div>

      <div className="flex flex-col gap-6">
        <div><h1 className="font-display text-3xl leading-none sm:text-5xl">Painel Ripado Decorativo</h1><p className="mt-3 text-base leading-relaxed text-[#5c5049]">Design que transforma. Instalação que simplifica.</p></div>
        <a href="#avaliacoes" className="flex items-center gap-2"><Stars value={4.7}/><strong className="text-sm">4,7</strong><span className="text-sm text-[#7d6f64] underline decoration-[#d8cec2] underline-offset-4">220 avaliações</span></a>
        <div id="configurar-painel" className="flex flex-col gap-6" style={{ scrollMarginTop: 72 }}>
          <div className="border-y border-[#e6ded4] py-4"><div className="flex items-baseline gap-2"><strong className="font-display text-4xl font-normal">Desde {euro(5)}</strong><span className="text-sm text-[#7d6f64]">por painel</span></div><strong className="mt-1 block text-sm text-[#8a5a2b]">Preço promocional E-com.casa</strong><p className="mt-1 text-xs text-[#7d6f64]">Preço normal no catálogo desde {euro(20)}. Campanha aplicada automaticamente no checkout.</p></div>
          <div><div className="mb-2 flex gap-2"><strong className="text-sm">Cor:</strong><span className="text-sm text-[#7d6f64]">{color !== null ? COLORS[color][0] : 'Escolha uma opção'}</span></div><div className="flex gap-2 overflow-x-auto rounded-full border border-[#e0d6cb] bg-[#fdfbf9] px-4 py-2">{COLORS.map(([name, src], i) => <button key={name} onClick={() => setColor(i)} title={name} className={`h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 p-0.5 ${i === color ? 'border-[#8a5a2b]' : 'border-transparent'}`}><img src={src} alt={name} className="h-full w-full rounded-full object-cover" /></button>)}</div></div>
          <div><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-baseline gap-2"><span className="text-xs font-bold text-[#a89a8d]">01</span><strong className="text-sm">Tamanho:</strong><span className="text-sm text-[#7d6f64]">{selected?.name ?? 'Escolha uma opção'}</span></div><button onClick={() => setCalculator(!calculator)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a5a2b]"><Ruler className="h-4 w-4"/>Quantos painéis preciso?</button></div>
            <div className="grid grid-cols-2 gap-2">{product.variants.map((variant) => { const disabled = variant.availability === 'outOfStock'; const reg = product.priceCents + variant.priceDeltaCents; const offer = reg * .25; return <button key={variant.id} disabled={disabled} onClick={() => { setVariantId(variant.id); trackOfferEvent('variant_selected', { offerSlug: offer.slug, productSlug: product.slug, variantId: variant.id }); }} className={`flex min-h-20 flex-col justify-center rounded-lg border p-3 text-left ${disabled ? 'cursor-not-allowed border-[#ded9d4] bg-[#efedeb] text-[#9a948e]' : variant.id === selected?.id ? 'border-[#8a5a2b] bg-[#fdfbf9]' : 'border-[#e0d6cb] bg-[#fdfbf9]'}`}><strong className="text-sm">{variant.name}</strong><span className="text-xs">{disabled ? 'Esgotado' : `${euro(offer)} / unidade · normal ${euro(reg / 100)}`}</span></button>})}</div>
            {calculator && <div className="mt-3 rounded-lg border border-[#e0d6cb] bg-[#fdfbf9] p-4"><p className="text-sm font-semibold">Calculadora rápida</p><div className="mt-3 grid grid-cols-2 gap-2"><input value={wallWidth} onChange={(e)=>setWallWidth(e.target.value)} placeholder="Largura cm" className="h-10 rounded-md border px-3 text-sm"/><input value={wallHeight} onChange={(e)=>setWallHeight(e.target.value)} placeholder="Altura cm" className="h-10 rounded-md border px-3 text-sm"/></div>{estimate && <p className="mt-3 text-sm">Estimativa: <strong>{estimate} painéis</strong></p>}</div>}
          </div>
          <div><span className="mb-2 block text-base font-semibold text-[#3d342e]">Quantidade</span><div className="flex h-12 items-center justify-between rounded-xl bg-[#f1ece6] px-1"><button onClick={()=>setQty(Math.max(1,qty-1))} className="grid h-10 w-10 place-items-center"><Minus className="h-4 w-4"/></button><strong>{qty} {qty===1?'painel':'painéis'}</strong><button onClick={()=>setQty(Math.min(product.stock,qty+1))} className="grid h-10 w-10 place-items-center rounded-lg bg-[#201a17] text-white"><Plus className="h-4 w-4"/></button></div></div>
          <div className="space-y-3"><div className="flex items-baseline justify-between"><span className="text-sm text-[#7d6f64]">Total promocional</span><strong className="text-xl">{euro((offerCents * qty) / 100)}</strong></div><button onClick={()=>addLine(true)} className="w-full rounded-full bg-[#201a17] py-4 text-base font-semibold text-[#f7f3ef] hover:bg-[#8a5a2b]">Comprar agora</button><button onClick={()=>addLine(false)} className="w-full rounded-full border border-[#201a17] py-3.5 text-sm font-semibold hover:bg-[#efe7de]">Adicionar ao carrinho</button><p className="text-xs leading-relaxed text-[#7d6f64]">Pagamento protegido · Campanha {CAMPAIGN_CODE} aplicada automaticamente · Entrega e acompanhamento confirmados no checkout</p></div>
        </div>
      </div>
    </div>
  </section>;
}

function FactoryPrice() {
  const [playing, setPlaying] = useState(false); const videoRef = useRef<HTMLVideoElement>(null);
  const toggle = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play().then(()=>setPlaying(true)).catch(()=>{}); else { v.pause(); setPlaying(false); } };
  return <section id="preco-fabrica" className="bg-[#201a17] px-4 py-14 text-[#f7f3ef] sm:px-6 sm:py-20"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div className="max-w-2xl"><p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#c79a68]"><Factory className="h-4 w-4"/>E-com.casa · Oferta direta online</p><h2 className="font-display text-4xl font-normal leading-[1.08] sm:text-6xl">Do catálogo.<span className="block text-[#d4aa7b]">Para a sua casa.</span></h2><p className="mt-5 text-[15px] leading-7 text-[#cbbbaf]"><strong className="text-white">Uma campanha dedicada ao produto.</strong> A página promocional concentra seleção, medidas, inspiração e checkout num único percurso.</p><div className="relative mt-5 aspect-video max-w-[520px] overflow-hidden rounded-[22px] bg-[#15110f]"><video ref={videoRef} src={`${ASSET}/videos/nuralta-hist.mp4`} poster={`${ASSET}/videos/nuralta-hist-poster.webp`} loop playsInline preload="metadata" className="h-full w-full object-cover" onClick={toggle}/><button onClick={toggle} className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#201a17]/70 text-white"><Play className="h-5 w-5" fill="currentColor"/></button></div><p className="mt-5 text-[15px] leading-7 text-[#f7f3ef]">Preço promocional exclusivo desta offer, com validação no servidor e pagamento através do checkout E-com.casa.</p></div><a href="#configurar-painel" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#c79a68] px-5 text-sm font-bold text-[#201a17]">Escolher cor e tamanho<ArrowRight className="h-4 w-4"/></a></div></section>;
}

function Transformation() { return <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="grid gap-10 lg:grid-cols-2 lg:items-center"><div><p className="mb-3 text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Textura, ritmo, calor</p><h2 className="font-display text-4xl leading-tight">Um detalhe que muda a forma de sentir o espaço.</h2><p className="mt-5 leading-relaxed text-[#5c5049]">Crie uma parede com presença, textura e calor natural. O Painel Ripado Decorativo foi pensado para renovar salas, quartos, escritórios e espaços comerciais.</p><ul className="mt-6 space-y-2 text-sm text-[#3d342e]"><li>Transforma o ambiente rapidamente</li><li>Ritmo visual moderno e acolhedor</li><li>Instalação simples e acabamento elegante</li><li>Manutenção fácil no dia a dia</li></ul></div><div className="relative aspect-[4/5] overflow-hidden rounded-lg"><img src={`${ASSET}/images/gallery/walnut/img2.webp`} alt="Ambiente com painel ripado" className="h-full w-full object-cover"/></div></div></section>; }

function ProductDetails({ product }: { product: CatalogProduct }) {
  const details = [
    ['01','Medidas e cobertura','Dimensões, área e peso',[['Dimensões','240 × 60 cm, 260 × 70 cm e 270 × 80 cm'],['Área por painel','1,44 a 2,16 m², consoante a medida'],['Espessura total',product.dimensions || 'Consultar ficha do produto'],['Peso',product.weight || 'Varia consoante a medida']]],
    ['02','Materiais e acabamento','Composição e desempenho',[['Material',product.materials || 'MDF com revestimento decorativo'],['Acabamento','Mate, conforme a cor selecionada'],['Uso','Interior']]],
    ['03','Instalação e acessórios','O que recebe e como aplicar',[['Conteúdo','1 painel por unidade'],['Fixação','Adequada ao suporte da parede'],['Superfícies','Paredes interiores sólidas, limpas, secas e niveladas']]],
    ['04','Cuidados e garantia','Utilização e pós-venda',[['Cuidados',product.care || 'Limpar com pano macio'],['Devolução','Aplicam-se as condições E-com.casa e direitos legais do consumidor']]],
  ] as const;
  const [open,setOpen]=useState(0);
  return <section className="bg-[#201a17] px-4 py-16 text-[#f7f3ef] sm:px-6"><div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#c79a68]">Detalhes do produto</p><h2 className="mt-4 font-display text-4xl leading-tight">Tudo o que precisa de saber antes de instalar.</h2></div><div>{details.map(([n,title,sub,rows],i)=><div key={n} className="border-b border-white/15"><button onClick={()=>setOpen(open===i?-1:i)} className="flex w-full items-center gap-4 py-5 text-left"><span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-xs text-[#c79a68]">{n}</span><span className="flex-1"><strong className="block text-sm">{title}</strong><span className="text-xs text-[#b7a696]">{sub}</span></span><ChevronDown className={`h-4 w-4 ${open===i?'rotate-180':''}`}/></button>{open===i&&<dl className="pb-5">{rows.map(([dt,dd])=><div key={dt} className="grid gap-1 border-t border-white/10 py-3 text-sm sm:grid-cols-[145px_1fr]"><dt className="text-[#b7a696]">{dt}</dt><dd>{dd}</dd></div>)}</dl>}</div>)}</div></div></section>;
}

function Inspiration() { return <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="mb-7 flex items-end justify-between"><div><p className="text-[11px] uppercase tracking-[.18em] text-[#8a5a2b]">Inspiração</p><h2 className="mt-2 font-display text-4xl">Veja o efeito em diferentes ambientes.</h2></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{['gallery/oak/img1.webp','gallery/walnut/img2.webp','gallery/black/img1.webp','gallery/oak/img3.webp','gallery/walnut/img1.webp','gallery/black/img2.webp'].map((p)=><div key={p} className="aspect-[4/5] overflow-hidden rounded-lg bg-[#ece5dd]"><img src={`${ASSET}/images/${p}`} alt="Inspiração Painel Ripado" className="h-full w-full object-cover" loading="lazy"/></div>)}</div></section>; }

function Reviews() {
  const [lightbox,setLightbox]=useState<string|null>(null); const [filter,setFilter]=useState<'all'|'photos'>('all'); const visible=filter==='photos'?REVIEWS.filter(r=>r.photos.length):REVIEWS;
  return <section id="avaliacoes" className="border-y border-[#e6ded4] bg-[#fdfbf9] py-10" style={{scrollMarginTop:72}}><div className="mx-auto max-w-4xl px-4 sm:px-6"><div className="flex items-center justify-between"><h2 className="text-base font-bold sm:text-lg">Galeria de avaliações</h2><a href="#lista-avaliacoes" className="text-xs text-[#83766d]">Ver todas (36) ›</a></div><div className="mt-3 flex gap-2 overflow-x-auto pb-2">{REVIEW_THUMBS.map((src,i)=><button key={i} onClick={()=>setLightbox(src)} className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-[#ece5dd] sm:h-28 sm:w-24"><img src={src} alt={`Avaliação ${i+1}`} className="h-full w-full object-cover" loading="lazy"/></button>)}</div><div id="lista-avaliacoes" className="mt-5 border-t border-[#e6ded4] pt-5"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Avaliações</h3><span className="text-[11px] font-semibold text-[#4d7d44]">Experiências apresentadas na campanha</span></div><div className="mt-3 flex items-start gap-3"><strong className="text-3xl">4,7</strong><div><Stars value={4.7} size={16}/><span className="block text-xs text-[#83766d]">220 avaliações</span></div></div><div className="mt-4 flex gap-2"><button onClick={()=>setFilter('all')} className={`rounded-md px-3 py-2 text-[11px] ${filter==='all'?'bg-[#201a17] text-white':'bg-[#f0f2f3]'}`}>todas (220)</button><button onClick={()=>setFilter('photos')} className={`rounded-md px-3 py-2 text-[11px] ${filter==='photos'?'bg-[#201a17] text-white':'bg-[#f0f2f3]'}`}>com fotos (22)</button></div><div className="mt-2 divide-y divide-[#ece5dd]">{visible.map((r,i)=><article key={i} className="py-5"><div className="flex flex-wrap items-center gap-3"><Stars/><strong className="text-xs">{r.name}</strong><span className="text-[10px] text-[#8d7f73]">🇵🇹 {r.location} · {r.time}</span></div><h4 className="mt-2 text-sm font-bold">{r.title}</h4><p className="mt-1 text-xs leading-5 text-[#62574f]">{r.body}</p><div className="mt-3 flex gap-2 overflow-x-auto">{r.photos.map((p,pi)=><button key={pi} onClick={()=>setLightbox(p)} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg"><img src={p} alt="" className="h-full w-full object-cover"/></button>)}</div></article>)}</div><div className="mt-2 flex justify-between border-t border-[#e6ded4] pt-5 text-xs text-[#83766d]"><span>A mostrar 1–5 de 220</span><span>Página 1 de 44</span></div></div></div>{lightbox&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-5" onClick={()=>setLightbox(null)}><button className="absolute right-5 top-5 text-white"><X/></button><img src={lightbox} alt="Avaliação ampliada" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"/></div>}</section>;
}

function FAQ({ offer }: { offer: OfferConfig }) { const [open,setOpen]=useState(0); return <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6"><h2 className="font-display text-4xl">Perguntas frequentes</h2><div className="mt-7 border-t border-[#e0d6cb]">{offer.faqs.map((faq,i)=><div key={faq.question} className="border-b border-[#e0d6cb]"><button onClick={()=>setOpen(open===i?-1:i)} className="flex w-full items-center gap-4 py-5 text-left"><span className="w-7 text-xs font-bold text-[#a89a8d]">{String(i+1).padStart(2,'0')}</span><strong className="flex-1 text-sm">{faq.question}</strong><ChevronDown className={`h-4 w-4 ${open===i?'rotate-180':''}`}/></button>{open===i&&<p className="pb-5 pl-11 pr-8 text-sm leading-6 text-[#62574f]">{faq.answer}</p>}</div>)}</div></section>; }

function Footer() { return <footer className="border-t border-[#e0d6cb] bg-[#efe7de] px-4 py-10 text-[#5c5049] sm:px-6"><div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3"><div><strong className="font-display text-xl text-[#201a17]">E-com.casa</strong><p className="mt-2 text-xs leading-5">Make Your Space Yours.<br/>Operado por MGJ EXPERT LTD · England & Wales · Company No. 17422467.</p></div><div className="text-xs leading-6"><strong className="text-[#201a17]">Apoio</strong><p>support@e-com.casa<br/>+44 7451 214299</p></div><div className="flex flex-col text-xs leading-6"><strong className="text-[#201a17]">Informação legal</strong><Link href="/legal/terms">Termos</Link><Link href="/legal/privacy">Privacidade</Link><Link href="/legal/returns">Devoluções</Link><Link href="/contact">Contacto</Link></div></div></footer>; }

export function PainelRipadoExactOffer({ offer, product, market }: { offer: OfferConfig; product: CatalogProduct; market: OfferMarketContext }) {
  useEffect(() => { captureOfferAttribution(offer.slug); trackOfferEvent('offer_view', { offerSlug: offer.slug, productSlug: product.slug, country: market.countryCode, locale: market.locale }); }, [offer.slug, product.slug, market.countryCode, market.locale]);
  return <main id="top" className="min-h-screen overflow-x-hidden bg-[#f7f3ef] text-[#201a17]">
    <style jsx global>{`@keyframes ecomOfferTicker{to{transform:translateX(-50%)}}.ecom-offer-ticker{animation:ecomOfferTicker 26s linear infinite}@media(prefers-reduced-motion:reduce){.ecom-offer-ticker{animation:none}}`}</style>
    <TopTicker/><FloatingHeader/><ProductConfigurator product={product} offer={offer}/><FactoryPrice/><Transformation/><ProductDetails product={product}/><Inspiration/><Reviews/><FAQ offer={offer}/><Footer/>
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-[#d8cec2] bg-[#f7f3ef]/95 px-4 py-3 shadow-[0_-8px_24px_rgba(32,26,23,.14)] backdrop-blur sm:hidden"><div><span className="block text-[10px] text-[#7d6f64]">Oferta desde</span><strong>5,00 €</strong></div><a href="#configurar-painel" className="rounded-full bg-[#201a17] px-6 py-3 text-sm font-semibold text-white">Comprar agora</a></div>
  </main>;
}
