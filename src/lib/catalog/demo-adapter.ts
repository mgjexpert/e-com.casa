// ============================================================
// E-com.casa — JSON catalogue fallback
// ------------------------------------------------------------
// Reads the curated demo artefact and, when present, the generated
// Shopify supplier snapshot. Supplier rows remain explicitly staged
// (SUPPLIER_PENDING / PENDING) and cannot pass the saleability gate.
// This gives the storefront a real supplier-backed catalogue preview
// even when the production database is not provisioned.
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
  return path.join(process.cwd(), 'data', 'catalog', file);
}

function readProducts(file: string): CatalogProduct[] {
  try {
    const raw = readFileSync(dataPath(file), 'utf-8');
    const parsed = JSON.parse(raw) as JsonProduct[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((product) => ({
      ...product,
      variants: Array.isArray(product.variants) ? product.variants : [],
    }));
  } catch {
    return [];
  }
}

function load(): { products: CatalogProduct[]; categories: CatalogCategory[] } {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return { products: cache.products, categories: cache.categories };
  }

  const demoProducts = readProducts('generated-products.json');
  const supplierProducts = readProducts('generated-supplier-products.json');
  const products = [
    ...new Map([...demoProducts, ...supplierProducts].map((product) => [product.sku, product])).values(),
  ];

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
}

function matches(product: CatalogProduct, query: ProductQuery): boolean {
  if (query.category && product.categorySlug !== query.category) return false;
  if (query.subcategory && !product.subcategorySlugs.includes(query.subcategory)) return false;
  if (query.space && !product.spaceSlugs.includes(query.space)) return false;
  if (query.style && !product.styleSlugs.includes(query.style)) return false;
  if (query.collection && !product.collectionSlugs.includes(query.collection)) return false;
  if (query.material && !(product.materials ?? '').toLowerCase().includes(query.material.toLowerCase())) return false;
  if (query.colour && !(product.color ?? '').toLowerCase().includes(query.colour.toLowerCase())) return false;
  if (query.availability && product.availability !== query.availability) return false;
  if (query.minPrice !== undefined && product.priceCents < Math.round(query.minPrice * 100)) return false;
  if (query.maxPrice !== undefined && product.priceCents > Math.round(query.maxPrice * 100)) return false;
  if (query.q) {
    const needle = query.q.toLowerCase();
    const haystack = [
      product.name,
      product.subtitle,
      product.shortDescription,
      product.description,
      product.categorySlug,
      product.subcategorySlugs,
      product.styleSlugs,
      product.spaceSlugs,
      product.collectionSlugs,
      product.materials,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
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
      // Keep the curated demo assortment first and append supplier validation
      // candidates afterwards so production previews do not displace the home page.
      return arr.sort(
        (a, b) =>
          Number(a.complianceStatus === 'SUPPLIER_PENDING') - Number(b.complianceStatus === 'SUPPLIER_PENDING') ||
          Number(b.featured) - Number(a.featured) ||
          Number(b.isBestSeller) - Number(a.isBestSeller) ||
          a.name.localeCompare(b.name),
      );
  }
}

export class DemoCatalogAdapter implements CatalogAdapter {
  readonly name = 'json-fallback';

  async list(query: ProductQuery): Promise<ProductListResult> {
    const { products } = load();
    const filtered = products.filter((product) => product.complianceStatus !== 'BLOCKED' && matches(product, query));
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
    return products.find((product) => product.slug === slug && product.complianceStatus !== 'BLOCKED') ?? null;
  }

  async getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]> {
    const { categories } = load();
    const filtered = type ? categories.filter((category) => category.type === type) : categories;
    return [...filtered].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async count(): Promise<number> {
    const { products } = load();
    return products.filter((product) => product.complianceStatus !== 'BLOCKED').length;
  }
}
