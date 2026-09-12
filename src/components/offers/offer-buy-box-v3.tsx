'use client';

import { useLiveProduct } from '@/hooks/use-live-product';
import { cartStockLimit, quantityLimit } from '@/lib/catalog/inventory';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { formatPrice } from '@/lib/format';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { trackOfferEvent } from '@/lib/offers/analytics';
import type { CatalogProduct } from '@/lib/catalog/types';
import { cn } from '@/lib/utils';

const SWATCHES: Record<string, string> = {
  oak: '#b98c59',
  natural: '#b98c59',
  cream: '#e8dfcf',
  walnut: '#68462f',
  black: '#20201f',
  white: '#f2f0eb',
  grey: '#9b9b96',
  gray: '#9b9b96',
  brown: '#76533b',
};

function swatchFor(value: string) {
  const key = value.toLowerCase();
  return SWATCHES[key] ?? (key.includes('oak') ? SWATCHES.oak : key.includes('walnut') ? SWATCHES.walnut : key.includes('black') ? SWATCHES.black : '#b98c59');
}

function numberFromDimensions(dimensions?: string | null): { height: number; width: number } | null {
  if (!dimensions) return null;
  const values = dimensions.match(/\d+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(',', '.')));
  if (!values || values.length < 2) return null;
  return { height: values[0], width: values[1] };
}

export function OfferBuyBoxV3({ product: initialProduct, offerSlug }: { product: CatalogProduct; offerSlug: string }) {
  const product = useLiveProduct(initialProduct);
  const router = useRouter();
  const add = useCart((state) => state.add);
  const openCartDrawer = useCartDrawer((state) => state.open);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(product.variants[0]?.id);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [wallWidth, setWallWidth] = useState('');
  const [wallHeight, setWallHeight] = useState('');

  const saleable = isCatalogProductSaleable(product);
  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );
  const unitPriceCents = product.priceCents + (selectedVariant?.priceDeltaCents ?? 0);
  const unitPrice = (unitPriceCents / 100).toFixed(2);
  const panel = numberFromDimensions(product.dimensions);

  const estimatedPanels = useMemo(() => {
    const width = Number(wallWidth.replace(',', '.'));
    const height = Number(wallHeight.replace(',', '.'));
    if (!panel || !width || !height || width <= 0 || height <= 0) return null;
    if (height <= panel.height) return Math.max(1, Math.ceil(width / panel.width));
    const wallArea = width * height;
    const panelArea = panel.width * panel.height;
    return Math.max(1, Math.ceil(wallArea / panelArea));
  }, [panel, wallHeight, wallWidth]);

  const setQty = (next: number) => {
    const max = saleable ? Math.max(1, quantityLimit(product)) : 99;
    const value = Math.min(max, Math.max(1, next));
    setQuantity(value);
    trackOfferEvent('quantity_changed', { offerSlug, productSlug: product.slug, quantity: value });
  };

  const selectVariant = (id: string) => {
    setVariantId(id);
    trackOfferEvent('variant_selected', { offerSlug, productSlug: product.slug, variantId: id });
  };

  const addLine = () => {
    if (!saleable) return;
    add(
      {
        slug: product.slug,
        name: product.name,
        subtitle: selectedVariant
          ? `${product.subtitle ? `${product.subtitle} · ` : ''}${selectedVariant.name}`
          : product.subtitle,
        price: unitPrice,
        image: product.image,
        automaticDiscountPct: product.promoDiscountPct, promoEndsAt: product.promoEndsAt, maxStock: cartStockLimit(product),
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.name,
      },
      quantity,
    );
  };

  const addToCart = () => {
    if (!saleable) return;
    addLine();
    trackOfferEvent('add_to_cart', {
      offerSlug,
      productSlug: product.slug,
      variantId: selectedVariant?.id,
      quantity,
      value: (unitPriceCents * quantity) / 100,
      currency: product.currency,
    });
    openCartDrawer();
  };

  const buyNow = () => {
    if (!saleable) return;
    addLine();
    trackOfferEvent('begin_checkout', {
      offerSlug,
      productSlug: product.slug,
      variantId: selectedVariant?.id,
      quantity,
      value: (unitPriceCents * quantity) / 100,
      currency: product.currency,
    });
    router.push('/checkout');
  };

  const displaySizes = [
    { label: product.dimensions || '240 × 60 cm', price: formatPrice(unitPrice), active: true },
    { label: '260 × 70 cm', price: 'A confirmar', active: false },
    { label: '270 × 80 cm', price: 'A confirmar', active: false },
    { label: '270 × 110 cm', price: 'Indisponível', active: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] text-[#6c675e]">Desde</span>
          <span className="text-[30px] font-semibold leading-none tracking-[-0.025em] text-[#22211f]">{formatPrice(unitPrice)}</span>
          <span className="text-[13px] text-[#6c675e]">por painel</span>
        </div>
        <p className="mt-2 text-[12px] text-[#777168]">
          {saleable ? 'Preço ligado ao catálogo E-com.casa.' : 'Preço de referência do catálogo enquanto a disponibilidade comercial é validada.'}
        </p>
      </div>

      {product.variants.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5 text-[13px]">
            <span className="font-semibold text-[#262522]">Cor:</span>
            <span className="text-[#777168]">{selectedVariant?.name ?? 'Escolha uma opção'}</span>
          </div>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Cor">
            {product.variants.map((variant) => {
              const active = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectVariant(variant.id)}
                  title={variant.name}
                  className={cn(
                    'group relative h-12 w-12 rounded-[5px] border bg-white p-[3px] transition',
                    active ? 'border-[#262522] ring-1 ring-[#262522]' : 'border-[#d8d4cd] hover:border-[#8f887d]',
                  )}
                >
                  <span className="block h-full w-full rounded-[3px]" style={{ background: swatchFor(variant.value || variant.name) }} />
                  <span className="sr-only">{variant.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[13px]">
            <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-[#232321] text-[10px] font-semibold text-white">01</span>
            <span className="font-semibold text-[#262522]">Tamanho:</span>{' '}
            <span className="text-[#777168]">Escolha uma opção</span>
          </div>
          <button
            type="button"
            onClick={() => setCalculatorOpen((value) => !value)}
            className="hidden text-[11.5px] font-semibold text-[#4f5943] underline underline-offset-4 sm:inline"
          >
            Quantos painéis preciso?
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {displaySizes.map((size, index) => (
            <button
              key={`${size.label}-${index}`}
              type="button"
              disabled={!size.active}
              className={cn(
                'min-h-[64px] rounded-[5px] border px-3 py-2.5 text-left transition',
                size.active
                  ? 'border-[#262522] bg-[#f8f6f1] shadow-[inset_0_0_0_1px_#262522]'
                  : 'cursor-not-allowed border-[#ddd9d2] bg-white opacity-55',
              )}
            >
              <span className="block text-[12.5px] font-semibold text-[#262522]">{size.label}</span>
              <span className="mt-1 block text-[11px] text-[#777168]">{size.price}{size.active ? ' / unidade' : ''}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCalculatorOpen((value) => !value)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4f5943] underline underline-offset-4 sm:hidden"
        >
          Quantos painéis preciso?<ChevronDown className={cn('h-3.5 w-3.5 transition', calculatorOpen && 'rotate-180')} />
        </button>

        <div className={cn('grid transition-[grid-template-rows,opacity] duration-300', calculatorOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden">
            <div className="rounded-[6px] border border-[#ddd9d2] bg-[#f8f6f1] p-4">
              <p className="text-[12px] font-semibold text-[#262522]">Calculadora rápida</p>
              <p className="mt-1 text-[11px] leading-5 text-[#777168]">Introduza as medidas aproximadas da parede em centímetros.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[10.5px] font-medium text-[#625d55]">
                  Largura (cm)
                  <input value={wallWidth} onChange={(event) => setWallWidth(event.target.value)} inputMode="decimal" className="mt-1 h-10 w-full rounded-[4px] border border-[#d5d0c8] bg-white px-3 text-[13px] outline-none focus:border-[#262522]" placeholder="320" />
                </label>
                <label className="text-[10.5px] font-medium text-[#625d55]">
                  Altura (cm)
                  <input value={wallHeight} onChange={(event) => setWallHeight(event.target.value)} inputMode="decimal" className="mt-1 h-10 w-full rounded-[4px] border border-[#d5d0c8] bg-white px-3 text-[13px] outline-none focus:border-[#262522]" placeholder="240" />
                </label>
              </div>
              {estimatedPanels && <p className="mt-3 rounded-[4px] bg-white px-3 py-2 text-[12px] text-[#262522]">Estimativa inicial: <strong>{estimatedPanels} {estimatedPanels === 1 ? 'painel' : 'painéis'}</strong>. Confirme sempre cortes e remates antes da encomenda.</p>}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-semibold text-[#262522]">Quantidade</p>
        <div className="flex h-12 w-[142px] items-center overflow-hidden rounded-[5px] border border-[#d8d4cd] bg-white">
          <button type="button" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1} className="grid h-full w-12 place-items-center text-[#262522] disabled:opacity-30" aria-label="Diminuir quantidade"><Minus className="h-4 w-4" /></button>
          <span className="flex-1 text-center text-[13px] font-semibold tabular-nums">{quantity}</span>
          <button type="button" onClick={() => setQty(quantity + 1)} disabled={saleable && quantity >= quantityLimit(product)} className="grid h-full w-12 place-items-center text-[#262522] disabled:opacity-30" aria-label="Aumentar quantidade"><Plus className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={buyNow}
          disabled={!saleable}
          className="flex h-[54px] w-full items-center justify-center rounded-[5px] bg-[#242421] px-5 text-[13px] font-semibold uppercase tracking-[0.075em] text-white transition hover:bg-[#11110f] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saleable ? 'Comprar agora' : 'Disponibilidade a confirmar'}
        </button>
        <button
          type="button"
          onClick={addToCart}
          disabled={!saleable}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[5px] border border-[#2e2d29] bg-white px-5 text-[13px] font-semibold uppercase tracking-[0.055em] text-[#242421] transition hover:bg-[#f6f3ed] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ShoppingBag className="h-4 w-4" />Adicionar ao carrinho
        </button>
      </div>
    </div>
  );
}
