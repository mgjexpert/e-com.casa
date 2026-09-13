import { getProductOffers } from '../offers/store';
// ============================================================
// E-com.casa — Catalog service (the ONLY catalogue entrypoint)
// ------------------------------------------------------------
// The UI must call these abstractions, never Prisma queries scattered across
// components. Adapter resolution:
//   1. prisma        — PostgreSQL Product table when provisioned and populated
//   2. file-catalog  — validated ODEM/WoodUpp partner snapshot
//
// ResearchProduct and historic demo datasets no longer participate in the
// storefront adapter chain once the partner snapshot exists.
// ============================================================

import { db } from '@/lib/db';
import { applyCommerce } from './commerce';
import { PrismaCatalogAdapter } from './prisma-adapter';
import { DemoCatalogAdapter, matchesCatalogProduct, sortCatalogProducts } from './demo-adapter';
import { getCompleteTheLook as computeCompleteTheLook, getRelatedProducts as computeRelated, getCrossSell as computeCrossSell } from './recommendations';
import type {
  CatalogAdapter,
  CatalogCategory,
  CatalogProduct,
  ProductListResult,
  ProductQuery,
} from './types';

export type { CatalogProduct, CatalogCategory, ProductListResult, ProductQuery, ProductVariant } from './types';
export { mapProduct } from './prisma-adapter';

const prismaAdapter = new PrismaCatalogAdapter(db);
const fileAdapter = new DemoCatalogAdapter();

let databaseHealthy: boolean | null = null;
let productTableReady: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_TTL_MS = 60_000;

async function activeAdapter(): Promise<CatalogAdapter> {
  if (databaseHealthy === null || Date.now() - lastHealthCheck > HEALTH_TTL_MS) {
    try {
      await db.$queryRaw`SELECT 1`;
      databaseHealthy = true;
      productTableReady = null;
    } catch {
      databaseHealthy = false;
      productTableReady = false;
    }
    lastHealthCheck = Date.now();
  }

  if (!databaseHealthy) return fileAdapter;

  // Use PostgreSQL only when the normalized Product table genuinely exists and
  // is populated. A healthy connection alone is not enough: historically the
  // production DB existed before the Product table was provisioned.
  if (productTableReady !== false) {
    try {
      if ((await prismaAdapter.count()) > 0) {
        productTableReady = true;
        return prismaAdapter;
      }
      productTableReady = false;
    } catch {
      productTableReady = false;
    }
  }

  return fileAdapter;
}

/** Which adapter is currently serving the catalogue (for diagnostics). */
export async function catalogStatus(): Promise<{ adapter: string; products: number; source?: string }> {
  const adapter = await activeAdapter();
  return {
    adapter: adapter.name,
    products: await adapter.count(),
    source: adapter === fileAdapter ? fileAdapter.getSource() : 'postgresql',
  };
}

let rawCache: { adapter: string; at: number; products: CatalogProduct[] } | null = null;

async function catalogOffers() {
  try {
    return await getProductOffers();
  } catch (error) {
    // Safe failure mode: keep products available from the validated snapshot,
    // but never reactivate or synthesize a database-controlled promotion.
    console.warn('[catalog] Product offers unavailable; serving regular catalogue prices.', error);
    return [];
  }
}

export async function getProducts(query: ProductQuery = {}): Promise<ProductListResult> {
  const adapter = await activeAdapter();
  if (!rawCache || rawCache.adapter !== adapter.name || Date.now() - rawCache.at > 30000) {
    const first = await adapter.list({ perPage: 48 });
    const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => adapter.list({ perPage: 48, page: i + 2 })));
    const primaryProducts = [first, ...rest].flatMap(r => r.products);
    const stagedProducts = adapter === fileAdapter ? [] : fileAdapter.getAllProducts();
    const mergedProducts = [...new Map([...primaryProducts, ...stagedProducts].map(product => [product.slug, product])).values()];
    rawCache = { adapter: adapter.name, at: Date.now(), products: mergedProducts };
  }
  const offers = await catalogOffers();
  const priced = rawCache.products.map(p => applyCommerce({ ...p, funnelOffer: offers.find(o => o.productSlug === p.slug) ?? null })).filter(p => (!query.funnelOnly || Boolean(p.offerSlug)) && matchesCatalogProduct(p, query));
  const sorted = sortCatalogProducts(priced, query.sort);
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 24));
  return { products: sorted.slice((page - 1) * perPage, page * perPage), total: sorted.length, page, perPage, totalPages: Math.max(1, Math.ceil(sorted.length / perPage)) };
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  const adapter = await activeAdapter();
  let product = await adapter.getBySlug(slug);
  // Partner additions deploy with the validated snapshot before the next
  // idempotent database import. Keep the individual PDP/offer available during
  // that short synchronization window without replacing the active DB listing.
  if (!product && adapter !== fileAdapter) product = await fileAdapter.getBySlug(slug);
  if (!product) return null;
  const offers = await catalogOffers();
  return applyCommerce({ ...product, funnelOffer: offers.find(o => o.productSlug === product.slug) ?? null });
}

export async function getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]> {
  return (await activeAdapter()).getCategories(type);
}

export async function getFeaturedProducts(limit = 8): Promise<CatalogProduct[]> {
  const { products } = await getProducts({ sort: 'featured', perPage: 48 });
  return products.filter((p) => p.featured).slice(0, limit);
}

export async function getBestSellers(limit = 8): Promise<CatalogProduct[]> {
  const { products } = await getProducts({ sort: 'best', perPage: 48 });
  return products.filter((p) => p.isBestSeller).slice(0, limit);
}

export async function getNewArrivals(limit = 8): Promise<CatalogProduct[]> {
  const { products } = await getProducts({ sort: 'new', perPage: 48 });
  return products.filter((p) => p.isNew).slice(0, limit);
}

export async function getProductsByCollection(collection: string, query: ProductQuery = {}): Promise<ProductListResult> {
  return getProducts({ ...query, collection });
}

export async function getProductsByCategory(category: string, query: ProductQuery = {}): Promise<ProductListResult> {
  return getProducts({ ...query, category });
}

export async function getProductsByStyle(style: string, query: ProductQuery = {}): Promise<ProductListResult> {
  return getProducts({ ...query, style });
}

export async function getProductsBySpace(space: string, query: ProductQuery = {}): Promise<ProductListResult> {
  return getProducts({ ...query, space });
}

export async function searchProducts(q: string, query: ProductQuery = {}): Promise<ProductListResult> {
  return getProducts({ ...query, q });
}

/** Loads the full active catalogue (cap 500) for recommendation engines. */
async function fullCatalogue(): Promise<CatalogProduct[]> {
  const { products } = await getProducts({ perPage: 48 });
  if (products.length < 48) return products;
  const { total } = await getProducts({ perPage: 1 });
  const pages = Math.ceil(Math.min(total, 500) / 48);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => getProducts({ perPage: 48, page: i + 2 })),
  );
  return [...products, ...rest.flatMap((r) => r.products)];
}

export async function getRelatedProducts(slug: string, limit = 6): Promise<CatalogProduct[]> {
  const anchor = await getProduct(slug);
  if (!anchor) return [];
  return computeRelated(anchor, await fullCatalogue(), limit);
}

export async function getCompleteTheLook(slug: string, limit = 4): Promise<CatalogProduct[]> {
  const anchor = await getProduct(slug);
  if (!anchor) return [];
  return computeCompleteTheLook(anchor, await fullCatalogue(), limit);
}

export async function getCrossSellForCart(slugs: string[], limit = 4): Promise<CatalogProduct[]> {
  const all = await fullCatalogue();
  const items = all.filter((p) => slugs.includes(p.slug));
  if (!items.length) return [];
  return computeCrossSell(items, all, limit);
}
