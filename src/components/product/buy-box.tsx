'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Minus, Plus, ShoppingBag, Zap, ShieldCheck, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { useT } from '@/hooks/use-t';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

const VARIANT_LABELS: Record<string, string> = {
  colour: 'Colour',
  size: 'Size',
  pack: 'Pack',
  material: 'Material',
};

export function BuyBox({ product }: { product: Product }) {
  const t = useT();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product.variants.length > 0 ? product.variants[0].id : undefined
  );
  const add = useCart((s) => s.add);
  const wishlist = useWishlist();
  const openCartDrawer = useCartDrawer((s) => s.open);
  const wished = wishlist.slugs.includes(product.slug);

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? (product.variants.length > 0 ? product.variants[0] : undefined);

  // Effective unit price = base + selected variant delta (server re-verifies at order time)
  const unitPriceCents = product.priceCents + (selectedVariant?.priceDeltaCents ?? 0);
  const unitPrice = (unitPriceCents / 100).toFixed(2);
  const variantSubtitle = selectedVariant ? `${product.subtitle ? product.subtitle + ' · ' : ''}${selectedVariant.name}` : product.subtitle;

  const addLine = () => {
    add(
      {
        slug: product.slug,
        name: product.name,
        subtitle: variantSubtitle,
        price: unitPrice,
        image: product.image,
        maxStock: product.stock,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.name,
      },
      qty
    );
  };

  const onAdd = () => {
    addLine();
    openCartDrawer();
  };

  const onBuyNow = () => {
    addLine();
    router.push('/checkout');
  };

  const onWishlist = () => {
    wishlist.toggle(product.slug);
    toast({ title: wished ? t('card.removedToast') : t('card.savedToast'), description: product.name });
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[26px] font-semibold tracking-tight">{formatPrice(unitPrice)}</span>
        {product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price) && (
          <span className="text-[15px] text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
        )}
        <span className="text-[12px] text-muted-foreground">{t('buy.inclVat')}</span>
      </div>

      {/* Variants */}
      {groupVariants(product.variants).map(([type, variants]) => (
        <div key={type} className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {VARIANT_LABELS[type] ?? type}
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={VARIANT_LABELS[type] ?? type}>
            {variants.map((v) => {
              const active = selectedVariant?.id === v.id;
              const priceNote = v.priceDeltaCents > 0 ? ` (+${formatPrice((v.priceDeltaCents / 100).toFixed(2))})` : '';
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={cn(
                    'min-h-[44px] rounded-md border px-4 py-2 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'border-olive bg-olive/5 text-olive'
                      : 'border-border bg-background text-foreground/80 hover:border-olive/50 hover:text-foreground'
                  )}
                >
                  {v.name}
                  {priceNote}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quantity + actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-12 w-fit items-center rounded-md border border-input">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-full w-11 items-center justify-center transition-colors hover:bg-accent disabled:opacity-40"
            disabled={qty <= 1}
            aria-label={t('buy.decrease')}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-[14px] font-medium tabular-nums" aria-live="polite" aria-label={t('buy.quantity', { n: qty })}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))}
            className="flex h-full w-11 items-center justify-center transition-colors hover:bg-accent disabled:opacity-40"
            disabled={qty >= (product.stock || 99)}
            aria-label={t('buy.increase')}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={onAdd} className="h-12 flex-1 gap-2 rounded-md bg-primary text-[14px] font-semibold hover:bg-primary/90">
          <ShoppingBag className="h-4.5 w-4.5" strokeWidth={1.75} />
          {t('buy.add')}
        </Button>
      </div>
      <div className="mt-3 flex gap-3">
        <Button
          onClick={onBuyNow}
          variant="outline"
          className="h-12 flex-1 gap-2 rounded-md border-ink text-[14px] font-semibold hover:bg-ink hover:text-cream"
        >
          <Zap className="h-4 w-4" strokeWidth={1.75} />
          {t('buy.buyNow')}
        </Button>
        <Button
          onClick={onWishlist}
          variant="outline"
          className="h-12 w-12 rounded-md border-input p-0"
          aria-label={wished ? t('card.removeWishlistShort') : t('card.addWishlistShort')}
          aria-pressed={wished}
        >
          <Heart className={cn('h-5 w-5', wished && 'fill-terracotta text-terracotta')} strokeWidth={1.75} />
        </Button>
      </div>

      {/* Stock indicator with level meter */}
      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-[12.5px]" aria-live="polite">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              product.stock <= 0 ? 'bg-terracotta' : product.stock <= 10 ? 'bg-amber-star' : 'bg-olive'
            )}
            aria-hidden
          />
          {product.stock <= 0 ? (
            <span className="text-terracotta">{t('buy.outOfStock')}</span>
          ) : product.stock <= 10 ? (
            <span className="font-medium text-foreground">{t('buy.lowStock', { n: product.stock })}</span>
          ) : (
            <span className="text-muted-foreground">{t('buy.inStock')}</span>
          )}
        </p>
        {product.stock > 0 && product.stock <= 20 && (
          <div
            className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-border/70"
            role="progressbar"
            aria-valuenow={product.stock}
            aria-valuemin={0}
            aria-valuemax={20}
            aria-label={t('buy.remainingStock')}
          >
            <div
              className={cn('h-full rounded-full', product.stock <= 10 ? 'bg-amber-star' : 'bg-olive')}
              style={{ width: `${Math.max(8, (product.stock / 20) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Trust strip */}
      <ul className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
        {[
          { icon: Truck, label: t('buy.trustFreeShipping') },
          { icon: RotateCcw, label: t('buy.trustReturns') },
          { icon: ShieldCheck, label: t('buy.trustSecure') },
          { icon: Zap, label: t('buy.trustDispatch') },
        ].map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[12.5px] text-foreground/75">
            <item.icon className="h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}


/** Group variants by type preserving order. */
function groupVariants(variants: Product['variants']): Array<[string, Product['variants']]> {
  const groups = new Map<string, Product['variants']>();
  for (const v of variants) {
    const list = groups.get(v.type) ?? [];
    list.push(v);
    groups.set(v.type, list);
  }
  return [...groups.entries()];
}
