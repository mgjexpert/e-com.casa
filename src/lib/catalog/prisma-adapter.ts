// ============================================================
// E-com.casa — Prisma catalog adapter (PostgreSQL / Neon)
// ------------------------------------------------------------
// Maps database rows to the catalog domain. Never exposes
// internal research fields beyond sourceResearchId.
// ============================================================

import type { PrismaClient, Product as ProductRow, Category as CategoryRow } from '@prisma/client';
import type {
  CatalogAdapter,
  CatalogCategory,
  CatalogProduct,
  ProductListResult,
  ProductQuery,
  ProductVariant,
} from './types';

function parseVariants(json: string): ProductVariant[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toCents(price: string): number {
  const n = parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** DB row → domain product (price/comparePrice remain display strings). */
export function mapProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    subtitle: row.subtitle,
    shortDescription: row.shortDescription,
    description: row.description,
    price: row.price,
    priceCents: row.priceCents ?? toCents(row.price),
    comparePrice: row.comparePrice,
    currency: row.currency,
    categorySlug: row.categorySlug,
    subcategorySlugs: row.subcategorySlugs,
    spaceSlugs: row.spaceSlugs,
    styleSlugs: row.styleSlugs,
    collectionSlugs: row.collectionSlugs,
    image: row.image,
    hoverImage: row.hoverImage,
    gallery: row.gallery,
    imageStatus: row.imageStatus,
    badge: row.badge,
    rating: row.rating,
    reviewCount: row.reviewCount,
    stock: row.stock,
    availability: (row.availability as CatalogProduct['availability']) ?? 'inStock',
    isBestSeller: row.isBestSeller,
    isNew: row.isNew,
    featured: row.featured,
    materials: row.materials,
    dimensions: row.dimensions,
    weight: row.weight,
    care: row.care,
    color: row.color,
    shippingClass: row.shippingClass,
    variants: parseVariants(row.variantsJson),
    electrical: row.electrical,
    battery: row.battery,
    complianceStatus: row.complianceStatus,
    reviewMode: row.reviewMode,
    documentationStatus: row.documentationStatus,
    safetyJson: row.safetyJson,
    requiresComplianceReview: row.requiresComplianceReview,
    isDemo: row.isDemo,
    sourceResearchId: row.sourceResearchId,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCategory(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type as CatalogCategory['type'],
    image: row.image,
    subtitle: row.subtitle,
    sortOrder: row.sortOrder,
  };
}

function buildWhere(query: ProductQuery): Record<string, unknown> {
  const where: Record<string, unknown> = { complianceStatus: { not: 'BLOCKED' } };
  if (query.category) where.categorySlug = query.category;
  if (query.subcategory) where.subcategorySlugs = { contains: query.subcategory };
  if (query.space) where.spaceSlugs = { contains: query.space };
  if (query.style) where.styleSlugs = { contains: query.style };
  if (query.collection) where.collectionSlugs = { contains: query.collection };
  if (query.material) where.materials = { contains: query.material };
  if (query.colour) where.color = { contains: query.colour };
  if (query.availability) where.availability = query.availability;
  if (query.q) {
    // case-insensitive full-text-ish search across merchandising fields
    const qi = { contains: query.q, mode: 'insensitive' as const };
    where.OR = [
      { name: qi },
      { description: qi },
      { shortDescription: qi },
      { subtitle: qi },
      { categorySlug: qi },
      { subcategorySlugs: qi },
      { styleSlugs: qi },
      { spaceSlugs: qi },
      { collectionSlugs: qi },
      { materials: qi },
      { color: qi },
    ];
  }
  const min = query.minPrice;
  const max = query.maxPrice;
  if (min !== undefined || max !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (min !== undefined) priceFilter.gte = Math.round(min * 100);
    if (max !== undefined) priceFilter.lte = Math.round(max * 100);
    where.priceCents = priceFilter;
  }
  return where;
}

function buildOrder(sort: ProductQuery['sort']): Record<string, 'asc' | 'desc'> {
  switch (sort) {
    case 'price-asc':
      return { priceCents: 'asc' };
    case 'price-desc':
      return { priceCents: 'desc' };
    case 'rating':
      return { rating: 'desc' };
    case 'best':
      return { reviewCount: 'desc' };
    case 'new':
      return { createdAt: 'desc' };
    default:
      return { sortOrder: 'asc' };
  }
}

export class PrismaCatalogAdapter implements CatalogAdapter {
  readonly name = 'prisma';
  constructor(private readonly client: PrismaClient) {}

  async list(query: ProductQuery): Promise<ProductListResult> {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(48, Math.max(1, query.perPage ?? 24));
    const where = buildWhere(query);
    const [rows, total] = await Promise.all([
      this.client.product.findMany({
        where,
        orderBy: buildOrder(query.sort),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.client.product.count({ where }),
    ]);
    return {
      products: rows.map(mapProduct),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage) || 1,
    };
  }

  async getBySlug(slug: string): Promise<CatalogProduct | null> {
    const row = await this.client.product.findUnique({ where: { slug } });
    if (!row || row.complianceStatus === 'BLOCKED') return null;
    return mapProduct(row);
  }

  async getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]> {
    const rows = await this.client.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapCategory);
  }

  async count(): Promise<number> {
    return this.client.product.count({ where: { complianceStatus: { not: 'BLOCKED' } } });
  }
}
