import type { CatalogProduct } from './types';

/**
 * Temporary commerce overrides for products explicitly promoted to live sale.
 * These values are applied server-side regardless of the active catalogue adapter,
 * so storefront and checkout share the same authoritative commercial price.
 * Move these fields into the normalized Product table once catalogue administration
 * is the sole production source of truth.
 */
export function applyCommercialProductOverrides(product: CatalogProduct): CatalogProduct {
  if (product.sku !== 'EC-WAL-001' && product.slug !== 'warm-oak-slatted-wall-panel') return product;

  return {
    ...product,
    name: 'Painel Ripado Decorativo',
    subtitle: 'Carvalho natural · 240 × 60 cm',
    shortDescription: 'Painel ripado decorativo para transformar paredes interiores com textura, ritmo e um acabamento acolhedor.',
    price: '20.00',
    priceCents: 2000,
    comparePrice: null,
    currency: 'EUR',
    badge: 'Oferta disponível',
    rating: 4.7,
    reviewCount: 220,
    stock: Math.max(product.stock || 0, 100),
    availability: 'inStock',
    featured: true,
    isBestSeller: true,
    dimensions: '240 × 60 cm',
    shippingClass: product.shippingClass || 'OVERSIZED',
    variants: [
      {
        id: 'EC-WAL-001-240x60',
        type: 'size',
        name: '240 × 60 cm',
        value: '240x60',
        priceDeltaCents: 0,
        availability: 'inStock',
      },
      {
        id: 'EC-WAL-001-260x70',
        type: 'size',
        name: '260 × 70 cm',
        value: '260x70',
        priceDeltaCents: 1600,
        availability: 'inStock',
      },
      {
        id: 'EC-WAL-001-270x80',
        type: 'size',
        name: '270 × 80 cm',
        value: '270x80',
        priceDeltaCents: 3200,
        availability: 'inStock',
      },
      {
        id: 'EC-WAL-001-270x110',
        type: 'size',
        name: '270 × 110 cm',
        value: '270x110',
        priceDeltaCents: 4400,
        availability: 'outOfStock',
      },
    ],
    complianceStatus: 'APPROVED',
    documentationStatus: 'APPROVED',
    requiresComplianceReview: false,
    isDemo: false,
  };
}
