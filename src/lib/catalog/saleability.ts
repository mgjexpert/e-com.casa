import type { CatalogProduct } from './types';
import { hasStock } from './inventory';

const BLOCKED_COMPLIANCE = new Set([
  'DEMO',
  'BLOCKED',
  'PENDING',
  'PENDING_REVIEW',
  'SUPPLIER_PENDING',
]);

const BLOCKED_DOCUMENTATION = new Set([
  'DEMO',
  'BLOCKED',
  'PENDING',
  'PENDING_REVIEW',
  'MISSING',
]);

type SaleabilityProduct = Pick<
  CatalogProduct,
  'isDemo' | 'requiresComplianceReview' | 'complianceStatus' | 'documentationStatus' | 'availability' | 'stock' | 'stockKnown' | 'stockUnlimited'
> & Pick<CatalogProduct, 'canPurchase'>;

export function isCatalogProductSaleable(product: SaleabilityProduct): boolean {
  // Once a product has crossed the server -> browser boundary, the internal
  // hold reasons are intentionally stripped. In that case the server-computed
  // customer-safe purchase decision is authoritative.
  if (typeof product.canPurchase === 'boolean') return product.canPurchase;

  if (product.isDemo || product.requiresComplianceReview) return false;

  if (BLOCKED_COMPLIANCE.has(String(product.complianceStatus || '').toUpperCase())) return false;
  if (BLOCKED_DOCUMENTATION.has(String(product.documentationStatus || '').toUpperCase())) return false;
  if (!hasStock(product)) return false;
  return true;
}

/**
 * Customer-facing availability copy only.
 * Internal supplier/compliance/documentation states must stay in DB/admin and
 * must never leak through storefront labels.
 */
export function getCatalogSaleabilityLabel(product: SaleabilityProduct): string {
  if (typeof product.canPurchase === 'boolean') {
    if (product.canPurchase) return product.stockUnlimited ? 'Made to order' : 'Available';
    if (!product.stockUnlimited && product.stockKnown === false && product.availability !== 'outOfStock') return 'Availability to confirm';
    if (product.availability === 'outOfStock') return 'Out of stock';
    return 'Temporarily unavailable';
  }

  if (product.isDemo) return 'Preview';
  if (!product.stockUnlimited && product.stockKnown === false && product.availability !== 'outOfStock') return 'Availability to confirm';
  if (
    product.requiresComplianceReview ||
    BLOCKED_COMPLIANCE.has(String(product.complianceStatus || '').toUpperCase()) ||
    BLOCKED_DOCUMENTATION.has(String(product.documentationStatus || '').toUpperCase())
  ) {
    return 'Temporarily unavailable';
  }
  if (!hasStock(product)) return 'Out of stock';
  return product.stockUnlimited ? 'Made to order' : 'Available';
}
