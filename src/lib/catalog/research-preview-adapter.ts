// ============================================================
// E-com.casa — research DB + JSON composite catalogue adapter
// ------------------------------------------------------------
// Production currently has the internal ResearchProduct tables but may not
// yet have the public Product table. This adapter keeps the storefront alive
// on its JSON catalogue while exposing normalized BigBuy research records.
// Internal validation/compliance state remains in the domain model and is
// deliberately not turned into customer-facing messaging by this adapter.
// ============================================================

import type { PrismaClient, ResearchProduct as ResearchProductRow } from '@prisma/client';
import type {
  CatalogAdapter,
  CatalogCategory,
  CatalogProduct,
  ProductListResult,
  ProductQuery,
} from './types';
import { DemoCatalogAdapter, matchesCatalogProduct, sortCatalogProducts } from './demo-adapter';
import { getMarketPricing } from './market-pricing';

const PLACEHOLDER_IMAGE = '/images/product-awaiting-media.svg';
const TRUSTED_SUPPLIER_MEDIA = new Set(['cdnbigbuy.com']);

function slugify(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}

function parseJson(value: string | null): Record<string, unknown> {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseSupplierImages(value: string | null): string[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, all) => all.indexOf(item) === index)
      .filter((item) => {
        try {
          const url = new URL(item);
          return url.protocol === 'https:' && TRUSTED_SUPPLIER_MEDIA.has(url.hostname.toLowerCase());
        } catch {
          return false;
        }
      })
      .slice(0, 12);
  } catch {
    return [];
  }
}

function categoryFor(row: ResearchProductRow): string {
  if (row.sourceCategory === 'Iluminação') return 'lighting';
  const sub = String(row.sourceSubcategory || '').toLowerCase();
  if (/têxteis|texteis|decora/.test(sub)) return 'decoration';
  if (/móveis|moveis/.test(sub)) return 'interior';
  return 'interior';
}

function mapResearchProduct(row: ResearchProductRow): CatalogProduct | null {
  if (!row.sourceProductId || !row.sourceProductName) return null;
  const supplierId = String(row.sourceProductId);
  const sourceData = parseJson(row.sourceDataJson);
  const electrical = sourceData.electrical === true;
  const baseSlug = slugify(row.sourceProductName) || 'bigbuy-product';
  const subtitle = [row.sourceBrand, row.sourceSubcategory].filter(Boolean).join(' · ') || null;
  const description = row.sourceDescription || row.sourceProductName;
  const supplierImages = parseSupplierImages(row.sourceImageUrls);
  const market = getMarketPricing(supplierId);
  const mainImage = supplierImages[0] ?? PLACEHOLDER_IMAGE;
  const gallery = supplierImages.slice(1);
  const safetyJson = JSON.stringify({
    productIdentifier: `BIGBUY-${supplierId}`,
    manufacturerName: null,
    manufacturerAddress: null,
    manufacturerEmail: null,
    euResponsiblePerson: null,
    countryOfOrigin: null,
    warnings: [],
    safetyInstructions: [],
    ceMarking: electrical ? '[TO BE CONFIRMED]' : 'NOT_CONFIRMED',
    weee: electrical ? '[TO BE CONFIRMED]' : 'NOT_APPLICABLE',
  });

  return {
    id: `research-${row.id}`,
    slug: `${baseSlug}-bb-${supplierId}`,
    sku: `EC-BB-${supplierId}`,
    name: row.sourceProductName,
    subtitle,
    shortDescription: description,
    description,
    price: market?.displayPrice ?? '0.00',
    priceCents: market?.displayPriceCents ?? 0,
    comparePrice: null,
    currency: 'EUR',
    marketReferencePrice: market?.marketAverage ?? null,
    marketReferenceSampleCount: market?.sampleCount ?? 0,
    marketReferenceConfidence: market?.confidence ?? null,
    marketReferenceBasis: market?.basis ?? null,
    marketReferenceReviewedAt: market?.reviewedAt ?? null,
    promoDiscountPct: market?.promoDiscountPct ?? null,
    promoEndsAt: market?.promoEndsAt ?? null,
    categorySlug: categoryFor(row),
    subcategorySlugs: slugify(row.sourceSubcategory || ''),
    spaceSlugs: '',
    styleSlugs: '',
    collectionSlugs: 'bigbuy-public-research',
    image: mainImage,
    hoverImage: supplierImages[1] ?? null,
    gallery: gallery.join(','),
    imageStatus: supplierImages.length > 0 ? 'SUPPLIER' : 'PLACEHOLDER',
    badge: null,
    rating: 0,
    reviewCount: 0,
    stock: 0,
    availability: 'outOfStock',
    isBestSeller: false,
    isNew: false,
    featured: false,
    materials: row.sourceMaterials,
    dimensions: row.sourceDimensions,
    weight: row.sourceWeight,
    care: null,
    color: row.sourceColours,
    shippingClass: 'SPECIAL',
    variants: [],
    electrical,
    battery: false,
    complianceStatus: 'PENDING_REVIEW',
    reviewMode: 'live',
    documentationStatus: 'PENDING',
    safetyJson,
    requiresComplianceReview: true,
    isDemo: false,
    sourceResearchId: row.id,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ResearchPreviewCatalogAdapter implements CatalogAdapter {
  readonly name = 'json+research-db';

  constructor(
    private readonly client: PrismaClient,
    private readonly fallback: DemoCatalogAdapter,
  ) {}

  private async researchProducts(): Promise<CatalogProduct[]> {
    try {
      const source = await this.client.researchSource.findUnique({ where: { key: 'bigbuy-public-index' } });
      if (!source) return [];
      const rows = await this.client.researchProduct.findMany({
        where: {
          sourceId: source.id,
          status: { in: ['NORMALIZED', 'SELECTED', 'IMPORTED'] },
          sourceProductId: { not: null },
        },
        orderBy: [{ researchScore: 'desc' }, { createdAt: 'asc' }],
        take: 1000,
      });
      return rows.map(mapResearchProduct).filter((product): product is CatalogProduct => product !== null);
    } catch (error) {
      console.warn('[catalog] research preview unavailable; using JSON fallback only', error);
      return [];
    }
  }

  private async allProducts(): Promise<CatalogProduct[]> {
    const local = this.fallback.getAllProducts();
    const research = await this.researchProducts();
    // A future Product/API/CSV row using the same EC-BB-* SKU should win over
    // the research preview. Until then, research rows supplement the fallback.
    return [...new Map([...research, ...local].map((product) => [product.sku, product])).values()];
  }

  async list(query: ProductQuery): Promise<ProductListResult> {
    const all = await this.allProducts();
    const filtered = all.filter((product) => product.complianceStatus !== 'BLOCKED' && matchesCatalogProduct(product, query));
    const sorted = sortCatalogProducts(filtered, query.sort);
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
    const all = await this.allProducts();
    return all.find((product) => product.slug === slug && product.complianceStatus !== 'BLOCKED') ?? null;
  }

  async getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]> {
    return this.fallback.getCategories(type);
  }

  async count(): Promise<number> {
    return (await this.allProducts()).filter((product) => product.complianceStatus !== 'BLOCKED').length;
  }
}
