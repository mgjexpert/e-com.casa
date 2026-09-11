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

export function getCatalogSaleabilityLabel(
  product: Pick<CatalogProduct, 'isDemo' | 'requiresComplianceReview' | 'complianceStatus' | 'documentationStatus' | 'availability' | 'stock'>,
): string {
  if (product.availability === 'outOfStock' || product.stock <= 0) return 'Out of stock';
  if (product.isDemo) return 'Catalogue preview';
  if (
    product.requiresComplianceReview ||
    BLOCKED_COMPLIANCE.has(String(product.complianceStatus || '').toUpperCase()) ||
    BLOCKED_DOCUMENTATION.has(String(product.documentationStatus || '').toUpperCase())
  ) {
    return 'Supplier validation in progress';
  }
  return 'Available';
}
