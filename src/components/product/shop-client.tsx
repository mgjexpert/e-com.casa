'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/product/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

const SHOP_CATEGORIES = [
  { slug: '', label: 'All Products' },
  { slug: 'wall-panels', label: 'Wall Panels' },
  { slug: 'lighting', label: 'Lighting' },
  { slug: 'garden', label: 'Garden' },
  { slug: 'outdoor', label: 'Outdoor' },
  { slug: 'decoration', label: 'Decoration' },
  { slug: 'organisation', label: 'Organisation' },
  { slug: 'interior', label: 'Interior' },
];

const SPACES = [
  { slug: 'living-room', label: 'Living Room' },
  { slug: 'bedroom', label: 'Bedroom' },
  { slug: 'kitchen', label: 'Kitchen' },
  { slug: 'bathroom', label: 'Bathroom' },
  { slug: 'garden', label: 'Garden' },
  { slug: 'balcony', label: 'Balcony' },
  { slug: 'home-office', label: 'Home Office' },
];

const STYLES = [
  { slug: 'warm-minimal', label: 'Warm Minimal' },
  { slug: 'natural', label: 'Natural' },
  { slug: 'modern', label: 'Modern' },
  { slug: 'japandi', label: 'Japandi' },
  { slug: 'organic', label: 'Organic' },
  { slug: 'neo-deco', label: 'Neo Deco' },
  { slug: 'mediterranean', label: 'Mediterranean' },
];

const PRICE_BANDS = [
  { slug: '', label: 'Any price' },
  { slug: '0-30', label: 'Under €30' },
  { slug: '30-60', label: '€30 – €60' },
  { slug: '60-100', label: '€60 – €100' },
  { slug: '100-9999', label: '€100+' },
];

function activeTitle(category: string, space: string, style: string, collection: string, q: string): string {
  if (q) return `Results for “${q}”`;
  if (collection) return collection.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  if (style) return STYLES.find((s) => s.slug === style)?.label ?? 'Shop';
  if (space) return SPACES.find((s) => s.slug === space)?.label ?? 'Shop';
  if (category) return SHOP_CATEGORIES.find((c) => c.slug === category)?.label ?? 'Shop';
  return 'All Products';
}

export function ShopClient() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get('category') ?? '';
  const space = params.get('space') ?? '';
  const style = params.get('style') ?? '';
  const collection = params.get('collection') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'featured';
  const priceBand = params.get('price') ?? '';

  const requestKey = `${category}|${space}|${style}|${collection}|${q}|${sort}|${priceBand}`;
  const [fetchResult, setFetchResult] = useState<{ key: string; products: Product[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loading = fetchResult?.key !== requestKey;
  const products = fetchResult?.key === requestKey ? fetchResult.products : [];
  const total = fetchResult?.key === requestKey ? fetchResult.total : 0;

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`/shop?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (space) sp.set('space', space);
    if (style) sp.set('style', style);
    if (collection) sp.set('collection', collection);
    if (q) sp.set('q', q);
    if (sort) sp.set('sort', sort);
    if (priceBand) {
      const [min, max] = priceBand.split('-');
      if (min) sp.set('minPrice', min);
      if (max) sp.set('maxPrice', max);
    }
    fetch(`/api/products?${sp.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load'))))
      .then((data) => {
        if (cancelled) return;
        setFetchResult({ key: requestKey, products: data.products ?? [], total: data.total ?? 0 });
      })
      .catch(() => {
        if (!cancelled) {
          setFetchResult({ key: requestKey, products: [], total: 0 });
          setError('Something went wrong loading products. Please refresh.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, category, space, style, collection, q, sort, priceBand]);

  const activeFilters = useMemo(
    () => [category, space, style, collection, priceBand].filter(Boolean).length + (q ? 1 : 0),
    [category, space, style, collection, priceBand, q]
  );

  const clearAll = () => router.replace('/shop');

  const title = activeTitle(category, space, style, collection, q);

  const filterGroup = (
    label: string,
    options: { slug: string; label: string }[],
    paramKey: string,
    current: string
  ) => (
    <div className="border-b border-border pb-5">
      <h3 className="eyebrow mb-3 text-muted-foreground">{label}</h3>
      <ul className="space-y-1">
        {options.map((opt) => (
          <li key={opt.slug || 'all'}>
            <button
              type="button"
              onClick={() => setParam(paramKey, opt.slug)}
              className={cn(
                'w-full rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-accent',
                current === opt.slug ? 'bg-accent font-medium text-foreground' : 'text-foreground/75'
              )}
              aria-pressed={current === opt.slug}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const sidebar = (
    <div className="space-y-5">
      {filterGroup('Category', SHOP_CATEGORIES, 'category', category)}
      {filterGroup('Space', SPACES, 'space', space)}
      {filterGroup('Style', STYLES, 'style', style)}
      <div className="border-b border-border pb-5">
        <h3 className="eyebrow mb-3 text-muted-foreground">Price</h3>
        <ul className="space-y-1">
          {PRICE_BANDS.map((band) => (
            <li key={band.slug || 'any'}>
              <button
                type="button"
                onClick={() => setParam('price', band.slug)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-accent',
                  priceBand === band.slug ? 'bg-accent font-medium text-foreground' : 'text-foreground/75'
                )}
              >
                {band.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {activeFilters > 0 && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full gap-1.5 rounded-md">
          <X className="h-3.5 w-3.5" /> Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-ecom py-8 lg:py-10">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-muted-foreground">
            <a href="/" className="hover:text-foreground">Home</a>
            <span className="mx-1.5" aria-hidden>/</span>
            <span className="text-foreground/80">Shop</span>
          </nav>
          <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[34px]">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground" aria-live="polite">
            {loading ? 'Loading pieces…' : `${total} ${total === 1 ? 'piece' : 'pieces'} ready for your space`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-md lg:hidden"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <div className="w-[190px]">
            <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
              <SelectTrigger className="h-9 rounded-md border-input bg-background text-[13px]" aria-label="Sort products">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="best">Best sellers</SelectItem>
                <SelectItem value="new">Newest</SelectItem>
                <SelectItem value="price-asc">Price, low to high</SelectItem>
                <SelectItem value="price-desc">Price, high to low</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block" aria-label="Product filters">
          {sidebar}
        </aside>

        {/* Products */}
        <div>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-square w-full rounded-md" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3.5 w-1/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-border bg-cream/60 px-6 py-16 text-center">
              <p className="font-display text-xl">Nothing here yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted-foreground">
                Try removing a filter or explore all products.
              </p>
              <Button onClick={clearAll} className="mt-5 rounded-md bg-primary px-6">
                Browse all products
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[65] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm overflow-y-auto bg-background p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">Filters</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
            <Button onClick={() => setFiltersOpen(false)} className="mt-6 w-full rounded-md bg-primary">
              Show {total} results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
