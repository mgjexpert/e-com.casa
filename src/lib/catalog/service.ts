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
import { PrismaCatalogAdapter } from './prisma-adapter';
import { DemoCatalogAdapter } from './demo-adapter';
import { applyCommercialProductOverrides } from './commercial-overrides';
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

export async function getProducts(query: ProductQuery = {}): Promise<ProductListResult> {
  const result = await (await activeAdapter()).list(query);
  return {
    ...result,
    products: result.products.map(applyCommercialProductOverrides),
  };
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  const product = await (await activeAdapter()).getBySlug(slug);
  return product ? applyCommercialProductOverrides(product) : null;
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
