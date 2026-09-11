import type { CatalogProduct } from './types';
import { isCatalogProductSaleable } from './saleability';

/**
 * Remove operational/supplier/compliance fields before a product crosses the
 * server -> browser boundary (API JSON or React Server Component props).
 *
 * The storefront only needs a customer-safe purchase decision. The reasons
 * for an internal hold stay in PostgreSQL / server code / future admin UI.
 */
export function toStorefrontProduct(product: CatalogProduct): CatalogProduct {
  const {
    complianceStatus: _complianceStatus,
    documentationStatus: _documentationStatus,
    safetyJson: _safetyJson,
    requiresComplianceReview: _requiresComplianceReview,
    reviewMode: _reviewMode,
    sourceResearchId: _sourceResearchId,
    isDemo: _isDemo,
    imageStatus: _imageStatus,
    ...publicProduct
  } = product;

  return {
    ...publicProduct,
    canPurchase: isCatalogProductSaleable(product),
  } as CatalogProduct;
}
