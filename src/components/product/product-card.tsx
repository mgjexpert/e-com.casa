'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCart } from '@/lib/cart-store';
import { useWishlist } from '@/lib/wishlist-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill={i <= Math.round(rating) ? 'var(--amber-star)' : 'none'}
          stroke={i <= Math.round(rating) ? 'var(--amber-star)' : '#c9c2b4'}
          strokeWidth="1.4"
          aria-hidden
        >
          <path d="M10 1.8l2.35 4.9 5.15.68-3.8 3.62.95 5.2L10 13.7l-4.65 2.5.95-5.2L2.5 7.38l5.15-.68L10 1.8z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const wishlist = useWishlist();
  const openCartDrawer = useCartDrawer((s) => s.open);
  const wished = wishlist.slugs.includes(product.slug);

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    add({
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle,
      price: product.price,
      image: product.image,
      maxStock: product.stock,
    });
    openCartDrawer();
  };

  const onWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    wishlist.toggle(product.slug);
    toast({
      title: wished ? 'Removed from wishlist' : 'Saved to wishlist',
      description: product.name,
    });
  };

  return (
    <article className="group relative">
      <Link
        href={`/product/${product.slug}`}
        className="block focus-visible:outline-ring rounded-md"
        aria-label={`${product.name}, ${formatPrice(product.price)}`}
      >
        <div className="relative aspect-[5/5] overflow-hidden rounded-md border border-border/60 bg-muted/40 transition-all duration-300 group-hover:border-ring/50 group-hover:shadow-[0_10px_28px_rgba(33,30,27,0.10)]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            className="img-zoom object-cover"
            priority={priority}
          />
          {/* Hover image swap (lifestyle shot) */}
          {product.hoverImage && (
            <Image
              src={product.hoverImage}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          {product.badge && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cream backdrop-blur">
              {product.badge}
            </span>
          )}
          {/* Hover add-to-cart */}
          <div className="absolute inset-x-2.5 bottom-2.5 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
            <button
              type="button"
              onClick={onAdd}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-ink/92 text-[12.5px] font-medium text-cream backdrop-blur transition-colors hover:bg-ink"
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add to cart
            </button>
          </div>
        </div>
        <div className="pt-3">
          <h3 className="line-clamp-1 text-[13.5px] font-medium leading-snug text-foreground/90 transition-colors group-hover:text-foreground">
            {product.name}
          </h3>
          {product.subtitle && (
            <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{product.subtitle}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <span className="text-[14px] font-semibold tracking-tight">{formatPrice(product.price)}</span>
            {product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price) && (
              <>
                <span className="text-[12px] text-muted-foreground line-through">
                  {formatPrice(product.comparePrice)}
                </span>
                <span
                  className="rounded-full bg-terracotta/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-terracotta"
                  aria-label={`Save ${Math.round((1 - parseFloat(product.price) / parseFloat(product.comparePrice)) * 100)} percent`}
                >
                  −{Math.round((1 - parseFloat(product.price) / parseFloat(product.comparePrice)) * 100)}%
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Stars rating={product.rating} />
            <span className="text-[11.5px] text-muted-foreground">({product.reviewCount})</span>
          </div>
          {product.stock > 0 && product.stock <= 10 && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta">
              <span className="h-1 w-1 rounded-full bg-terracotta" aria-hidden />
              Only {product.stock} left
            </p>
          )}
        </div>
      </Link>
      {/* Wishlist heart */}
      <button
        type="button"
        onClick={onWishlist}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        aria-pressed={wished}
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 backdrop-blur transition-all hover:scale-110 hover:bg-background"
      >
        <Heart
          className={cn('h-4 w-4 transition-colors', wished ? 'fill-terracotta text-terracotta' : 'text-foreground/70')}
          strokeWidth={1.75}
        />
      </button>
    </article>
  );
}
