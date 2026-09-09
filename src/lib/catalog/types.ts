// ============================================================
// E-com.casa — Catalog domain types
// ------------------------------------------------------------
// The storefront UI NEVER talks to Prisma directly for catalogue
// reads. It consumes these abstractions so the future production
// catalogue can be connected without redesigning the frontend.
// ============================================================

export type VariantType = 'colour' | 'size' | 'material' | 'pack';

export interface ProductVariant {
  id: string;
  type: VariantType;
  /** Display label, e.g. "Natural Oak" or "Set of 2" */
  name: string;
  /** Machine value, e.g. "oak" or "set-2" */
  value: string;
  /** Added cost in cents (0 = no delta) */
  priceDeltaCents: number;
  /** Optional per-variant image override */
  image?: string;
  /** Availability for this variant (demo) */
  availability?: 'inStock' | 'lowStock' | 'outOfStock';
}

export interface ProductSafety {
  /** Demo products carry placeholders — never fabricated compliance data */
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturerEmail: string;
  euResponsiblePerson: string;
  productIdentifier: string;
  countryOfOrigin: string | null;
  warnings: string[];
  safetyInstructions: string[];
  ceMarking: string; // "DEMO" | "[TO BE CONFIRMED]"
  weee: string; // "DEMO" | "[TO BE CONFIRMED]"
}

/** UI-facing product shape (serialized, JSON-safe). */
export interface CatalogProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  subtitle: string | null;
  shortDescription: string;
  description: string;
  price: string;
  priceCents: number;
  comparePrice: string | null;
  currency: string;
  categorySlug: string;
  subcategorySlugs: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs: string;
  image: string;
  hoverImage: string | null;
  gallery: string;
  imageStatus: string;
  badge: string | null;
  rating: number;
  reviewCount: number;
  stock: number;
  availability: 'inStock' | 'lowStock' | 'outOfStock';
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  color: string | null;
  shippingClass: string;
  variants: ProductVariant[];
  electrical: boolean;
  battery: boolean;
  complianceStatus: string;
  reviewMode: string;
  documentationStatus: string;
  safetyJson: string | null;
  requiresComplianceReview: boolean;
  isDemo: boolean;
  sourceResearchId: string | null;
  createdAt: string;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  type: 'space' | 'style' | 'collection' | 'shop';
  image: string | null;
  subtitle: string | null;
  sortOrder: number;
}

export interface ProductQuery {
  category?: string;
  subcategory?: string;
  space?: string;
  style?: string;
  collection?: string;
  material?: string;
  colour?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  sort?: 'featured' | 'best' | 'new' | 'price-asc' | 'price-desc' | 'rating';
  page?: number;
  perPage?: number;
}

export interface ProductListResult {
  products: CatalogProduct[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/** Storage-agnostic catalogue adapter contract. */
export interface CatalogAdapter {
  readonly name: string;
  list(query: ProductQuery): Promise<ProductListResult>;
  getBySlug(slug: string): Promise<CatalogProduct | null>;
  getCategories(type?: CatalogCategory['type']): Promise<CatalogCategory[]>;
  count(): Promise<number>;
}
