'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Minus, Plus, ShoppingBag, Zap, ShieldCheck, RotateCcw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

export function BuyBox({ product }: { product: Product }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const wishlist = useWishlist();
  const openCartDrawer = useCartDrawer((s) => s.open);
  const wished = wishlist.slugs.includes(product.slug);

  const addLine = () => {
    add(
      {
        slug: product.slug,
        name: product.name,
        subtitle: product.subtitle,
        price: product.price,
        image: product.image,
        maxStock: product.stock,
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
    toast({ title: wished ? 'Removed from wishlist' : 'Saved to wishlist', description: product.name });
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[26px] font-semibold tracking-tight">{formatPrice(product.price)}</span>
        {product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price) && (
          <span className="text-[15px] text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
        )}
        <span className="text-[12px] text-muted-foreground">incl. VAT</span>
      </div>

      {/* Quantity + actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-12 w-fit items-center rounded-md border border-input">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-full w-11 items-center justify-center transition-colors hover:bg-accent disabled:opacity-40"
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-[14px] font-medium tabular-nums" aria-live="polite" aria-label={`Quantity ${qty}`}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))}
            className="flex h-full w-11 items-center justify-center transition-colors hover:bg-accent disabled:opacity-40"
            disabled={qty >= (product.stock || 99)}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={onAdd} className="h-12 flex-1 gap-2 rounded-md bg-primary text-[14px] font-semibold hover:bg-primary/90">
          <ShoppingBag className="h-4.5 w-4.5" strokeWidth={1.75} />
          Add to cart
        </Button>
      </div>
      <div className="mt-3 flex gap-3">
        <Button
          onClick={onBuyNow}
          variant="outline"
          className="h-12 flex-1 gap-2 rounded-md border-ink text-[14px] font-semibold hover:bg-ink hover:text-cream"
        >
          <Zap className="h-4 w-4" strokeWidth={1.75} />
          Buy now
        </Button>
        <Button
          onClick={onWishlist}
          variant="outline"
          className="h-12 w-12 rounded-md border-input p-0"
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
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
            <span className="text-terracotta">Out of stock — check back soon</span>
          ) : product.stock <= 10 ? (
            <span className="font-medium text-foreground">Low stock — only {product.stock} left</span>
          ) : (
            <span className="text-muted-foreground">In stock — ready to ship</span>
          )}
        </p>
        {product.stock > 0 && product.stock <= 20 && (
          <div
            className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-border/70"
            role="progressbar"
            aria-valuenow={product.stock}
            aria-valuemin={0}
            aria-valuemax={20}
            aria-label="Remaining stock"
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
          { icon: Truck, label: 'Free shipping over €50' },
          { icon: RotateCcw, label: '14-day returns' },
          { icon: ShieldCheck, label: 'Secure checkout' },
          { icon: Zap, label: 'Dispatch in 24–48h' },
        ].map((t) => (
          <li key={t.label} className="flex items-center gap-2 text-[12.5px] text-foreground/75">
            <t.icon className="h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} />
            {t.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
