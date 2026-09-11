'use client';

import { cartStockLimit, quantityLimit } from '@/lib/catalog/inventory';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Zap, ShieldCheck } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { formatPrice } from '@/lib/format';
import { getCatalogSaleabilityLabel, isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { trackOfferEvent } from '@/lib/offers/analytics';
import type { CatalogProduct } from '@/lib/catalog/types';
import { cn } from '@/lib/utils';

export function OfferBuyBox({ product, offerSlug }: { product: CatalogProduct; offerSlug: string }) {
  const router = useRouter();
  const add = useCart((state) => state.add);
  const openCartDrawer = useCartDrawer((state) => state.open);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(product.variants[0]?.id);
  const saleable = isCatalogProductSaleable(product);
  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );
  const unitPriceCents = product.priceCents + (selectedVariant?.priceDeltaCents ?? 0);
  const unitPrice = (unitPriceCents / 100).toFixed(2);

  const selectVariant = (id: string) => {
    setVariantId(id);
    trackOfferEvent('variant_selected', { offerSlug, productSlug: product.slug, variantId: id });
  };

  const setQty = (next: number) => {
    const max = saleable ? Math.max(1, quantityLimit(product)) : 20;
    const value = Math.min(max, Math.max(1, next));
    setQuantity(value);
    trackOfferEvent('quantity_changed', { offerSlug, productSlug: product.slug, quantity: value });
  };

  const addLine = () => {
    if (!saleable) return;
    add(
      {
        slug: product.slug,
        name: product.name,
        subtitle: selectedVariant ? `${product.subtitle ? `${product.subtitle} · ` : ''}${selectedVariant.name}` : product.subtitle,
        price: unitPrice,
        image: product.image,
        maxStock: cartStockLimit(product),
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
      value: unitPriceCents * quantity / 100,
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
      value: unitPriceCents * quantity / 100,
      currency: product.currency,
    });
    router.push('/checkout');
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-[0_20px_60px_rgba(38,35,29,0.08)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {saleable ? 'Preço atual' : 'Preço de referência do catálogo'}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{formatPrice(unitPrice)}</p>
        </div>
        {saleable ? (
          <span className="rounded-full bg-olive/10 px-3 py-1.5 text-[11px] font-semibold text-olive">Em stock</span>
        ) : (
          <span className="rounded-full bg-amber-star/10 px-3 py-1.5 text-[11px] font-semibold text-foreground/70">
            {getCatalogSaleabilityLabel(product)}
          </span>
        )}
      </div>

      {product.variants.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acabamento</p>
            {selectedVariant && <span className="text-[12px] text-foreground/70">{selectedVariant.name}</span>}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Acabamento">
            {product.variants.map((variant) => {
              const active = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectVariant(variant.id)}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-all',
                    active ? 'border-olive bg-olive/5 text-olive shadow-sm' : 'border-border bg-background hover:border-olive/40',
                  )}
                >
                  {variant.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-12 items-center rounded-lg border border-input bg-background">
          <button type="button" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1} className="grid h-full w-11 place-items-center disabled:opacity-35" aria-label="Diminuir quantidade">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-9 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQty(quantity + 1)} disabled={saleable && quantity >= quantityLimit(product)} className="grid h-full w-11 place-items-center disabled:opacity-35" aria-label="Aumentar quantidade">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={buyNow}
          disabled={!saleable}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Zap className="h-4 w-4" />
          {saleable ? 'Comprar agora' : 'Compra em validação'}
        </button>
      </div>

      <button
        type="button"
        onClick={addToCart}
        disabled={!saleable}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink/20 bg-background text-[13px] font-semibold transition hover:border-ink/50 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ShoppingBag className="h-4 w-4" />
        {saleable ? 'Adicionar ao carrinho' : 'Aguardar validação do produto'}
      </button>

      <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-olive" />
        <p>
          A Offer reutiliza o catálogo, carrinho, checkout e XPayments existentes. Nenhum preço ou pagamento é criado em paralelo.
        </p>
      </div>
    </div>
  );
}
