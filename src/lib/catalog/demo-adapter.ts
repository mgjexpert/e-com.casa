// ============================================================
// E-com.casa — Demo catalog adapter (JSON artifact fallback)
// ------------------------------------------------------------
// Reads /data/catalog/generated-products.json + generated-catalog.json.
// Purpose:
//   1. Resilience — the storefront keeps rendering when the
//      database is unreachable (e.g. first boot, preview builds).
//   2. Reproducibility — the same artifacts the seed imports into
//      Neon power a fully static fallback of the demo catalogue.
// These artifacts are produced by the one-shot research pipeline
// and never contain secrets or third-party copyrighted content.
// ============================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  CatalogAdapter,
  CatalogCategory,
  CatalogProduct,
  ProductListResult,
  ProductQuery,
  ProductVariant,
} from './types';

type JsonProduct = Omit<CatalogProduct, 'variants'> & { variants?: ProductVariant[] };

let cache: { products: CatalogProduct[]; categories: CatalogCategory[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

function dataPath(file: string): string {
  // Works both from repo root and from bundled contexts
  return path.join(process.cwd(), 'data', 'catalog', file);
}

function load(): { products: CatalogProduct[]; categories: CatalogCategory[] } {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return { products: cache.products, categories: cache.categories };
  }
  try {
    const raw = readFileSync(dataPath('generated-products.json'), 'utf-8');
    const products = (JSON.parse(raw) as JsonProduct[]).map((p) => ({
      ...p,
      variants: Array.isArray(p.variants) ? p.variants : [],
    }));
    let categories: CatalogCategory[] = [];
    try {
      const catRaw = readFileSync(dataPath('generated-catalog.json'), 'utf-8');
      const parsed = JSON.parse(catRaw) as { categories?: CatalogCategory[] };
      categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    } catch {
      categories = [];
    }
    cache = { products, categories, loadedAt: Date.now() };
    return { products, categories };
  } catch {
    cache = { products: [], categories: [], loadedAt: Date.now() };
    return { products: [], categories: [] };
  }
}

function matches(p: CatalogProduct, q: ProductQuery): boolean {
  if (q.category && p.categorySlug !== q.category) return false;
  if (q.subcategory && !p.subcategorySlugs.includes(q.subcategory)) return false;
  if (q.space && !p.spaceSlugs.includes(q.space)) return false;
  if (q.style && !p.styleSlugs.includes(q.style)) return false;
  if (q.collection && !p.collectionSlugs.includes(q.collection)) return false;
  if (q.material && !(p.materials ?? '').toLowerCase().includes(q.material.toLowerCase())) return false;
  if (q.colour && !(p.color ?? '').toLowerCase().includes(q.colour.toLowerCase())) return false;
  if (q.availability && p.availability !== q.availability) return false;
  if (q.minPrice !== undefined && p.priceCents < Math.round(q.minPrice * 100)) return false;
  if (q.maxPrice !== undefined && p.priceCents > Math.round(q.maxPrice * 100)) return false;
  if (q.q) {
    const needle = q.q.toLowerCase();
    const hay = [p.name, p.subtitle, p.shortDescription, p.description, p.categorySlug, p.subcategorySlugs, p.styleSlugs, p.spaceSlugs, p.collectionSlugs, p.materials]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function sortProducts(products: CatalogProduct[], sort: ProductQuery['sort']): CatalogProduct[] {
  const arr = [...products];
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.priceCents - b.priceCents);
    case 'price-desc':
      return arr.sort((a, b) => b.priceCents - a.priceCents);
    case 'rating':
      return arr.sort((a, b) => b.rating - a.rating);
    case 'best':
      return arr.sort((a, b) => b.reviewCount - a.reviewCount);
    case 'new':
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    default:
      // featured first, then curated sortOrder (best sellers before rest)
      return arr.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || Number(b.isBestSeller) - Number(a.isBestSeller) || a.name.localeCompare(b.name),
      );
  }
}

export class DemoCatalogAdapter implements CatalogAdapter {
  readonly name = 'demo-json';

  async list(query: ProductQuery): Promise<ProductListResult> {
    const { products } = load();
    const filtered = products.filter((p) => p.complianceStatus !== 'BLOCKED' && matches(p, query));
    const sorted = sortProducts(filtered, query.sort);
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(48, Math.max(1, query.perPage ?? 24));
    const start = (page - 1) * perPage;
    return {
      products: sorted.slice(start, start + perPage),
      total: sorted.length,
      page,
      perPage,
      totalPages: Math.ceil(sorted.length / perPage) || 1,
    };
  }

  async getBySlug(slug: string): Promise<CatalogProduct | null> {
    const { products } = load();
    const found = products.find((p) => p.slug === slug && p.complianceStatus !== 'BLOCKED');
    return found ?? null;
  }

  async getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]> {
    const { categories } = load();
    const filtered = type ? categories.filter((c) => c.type === type) : categories;
    return [...filtered].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async count(): Promise<number> {
    const { products } = load();
    return products.filter((p) => p.complianceStatus !== 'BLOCKED').length;
  }
}
