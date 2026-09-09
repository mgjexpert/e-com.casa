'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductCard } from '@/components/product/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/lib/wishlist-store';
import type { Product } from '@/types';

export default function WishlistPage() {
  const wishlist = useWishlist();
  const [products, setProducts] = useState<Product[] | null>(null);
  const hydrated = wishlist.hydrated;
  const slugs = wishlist.slugs;
  const slugKey = slugs.join(',');

  useEffect(() => {
    if (!hydrated || slugs.length === 0) return;
    let cancelled = false;
    Promise.all(
      slugs.map((slug) =>
        fetch(`/api/products/${slug}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.product ? d.product : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (!cancelled) setProducts(results.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, slugKey]);

  const isEmpty = hydrated && slugs.length === 0;
  const visible = isEmpty ? [] : products;

  if (!hydrated || (visible === null && slugs.length > 0)) {
    return (
      <div className="container-ecom py-10">
        <Skeleton className="h-9 w-40" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container-ecom py-10 lg:py-14">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[32px]">Wishlist</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {visible.length === 0 ? 'Saved pieces will appear here.' : `${visible.length} saved ${visible.length === 1 ? 'piece' : 'pieces'}`}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-12 rounded-lg border border-border bg-cream/50 px-6 py-16 text-center">
          <Heart className="mx-auto h-9 w-9 text-muted-foreground" strokeWidth={1.25} />
          <p className="font-display mt-5 text-[20px]">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted-foreground">
            Tap the heart on any product to keep it here — no account needed. Saved on this device.
          </p>
          <Button asChild className="mt-6 rounded-md bg-primary px-7">
            <Link href="/shop">Discover the collection</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
