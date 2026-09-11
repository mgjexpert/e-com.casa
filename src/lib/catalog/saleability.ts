import type { CatalogProduct } from './types';

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

export function isCatalogProductSaleable(
  product: Pick<
    CatalogProduct,
    'isDemo' | 'requiresComplianceReview' | 'complianceStatus' | 'documentationStatus' | 'availability' | 'stock'
  >,
): boolean {
  if (product.isDemo || product.requiresComplianceReview) return false;
  if (BLOCKED_COMPLIANCE.has(String(product.complianceStatus || '').toUpperCase())) return false;
  if (BLOCKED_DOCUMENTATION.has(String(product.documentationStatus || '').toUpperCase())) return false;
  if (product.availability === 'outOfStock' || product.stock <= 0) return false;
  return true;
}

/**
 * Customer-facing availability copy only.
 * Internal supplier/compliance/documentation states must stay in DB/admin and
 * must never leak through storefront labels.
 */
export function getCatalogSaleabilityLabel(
  product: Pick<CatalogProduct, 'isDemo' | 'requiresComplianceReview' | 'complianceStatus' | 'documentationStatus' | 'availability' | 'stock'>,
): string {
  if (product.isDemo) return 'Preview';
  if (
    product.requiresComplianceReview ||
    BLOCKED_COMPLIANCE.has(String(product.complianceStatus || '').toUpperCase()) ||
    BLOCKED_DOCUMENTATION.has(String(product.documentationStatus || '').toUpperCase())
  ) {
    return 'Temporarily unavailable';
  }
  if (product.availability === 'outOfStock' || product.stock <= 0) return 'Out of stock';
  return 'Available';
}
