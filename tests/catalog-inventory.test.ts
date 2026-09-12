import { describe, expect, test, mock } from 'bun:test';
import { hasStock, cartStockLimit } from '../src/lib/catalog/inventory';
import { isCatalogProductSaleable } from '../src/lib/catalog/saleability';
import { DemoCatalogAdapter } from '../src/lib/catalog/demo-adapter';
import { readFileSync } from 'node:fs';
const snapshot = JSON.parse(readFileSync('data/catalog/generated-provider-products.json', 'utf8'));
const unlimited = { ...snapshot[0], supplierKey: null, stockUnlimited: true, stock: 0, stockKnown: false, availability: 'inStock', isDemo: false, requiresComplianceReview: false, complianceStatus: 'APPROVED', documentationStatus: 'APPROVED' };
mock.module('@/lib/catalog', () => ({ getProduct: async (slug: string) => slug === 'tracked' ? { ...unlimited, slug, stockUnlimited: false, stockKnown: true, stock: 5 } : { ...unlimited, slug } }));
const { repriceCart } = await import('../src/lib/checkout');
describe('direct manufacture', () => {
  test('unlimited quantity is independent of unknown physical stock', () => {
    expect(hasStock(unlimited, 100000)).toBe(true);
    expect(cartStockLimit(unlimited)).toBeNull();
    expect(isCatalogProductSaleable(unlimited)).toBe(true);
    expect(hasStock({ ...unlimited, stockUnlimited: false })).toBe(false);
  });
  test('finite stock, explicit holds and invalid quantities remain enforced', () => {
    expect(hasStock({ stock: 4, stockKnown: true }, 5)).toBe(false);
    expect(hasStock({ ...unlimited, availability: 'outOfStock' })).toBe(false);
    for (const quantity of [0, -1, 1.5, Infinity, NaN]) expect(hasStock(unlimited, quantity)).toBe(false);
    expect(isCatalogProductSaleable({ ...unlimited, requiresComplianceReview: true })).toBe(false);
    expect(isCatalogProductSaleable({ ...unlimited, documentationStatus: 'BLOCKED' })).toBe(false);
  });
  test('partner adapter contains only supplier products and preserves the offer anchor', async () => {
    const adapter = new DemoCatalogAdapter();
    expect(await adapter.count()).toBe(snapshot.length);
    expect(snapshot.every((p: any) => !p.isDemo && p.stockUnlimited && ['odem', 'woodupp'].includes(p.supplierKey))).toBe(true);
    expect((await adapter.getBySlug('odem-painel-ripado-acustico-carvalho'))?.stockUnlimited).toBe(true);
    expect(await adapter.getBySlug('warm-oak-slatted-wall-panel')).toBeNull();
  });
  test('checkout allows manufacture quantities but rejects aggregate overselling', async () => {
    const base = { country: 'PT', shippingMethod: 'standard' };
    const priced = await repriceCart({ ...base, items: [{ slug: 'manufactured', quantity: 1000 }] });
    expect(priced.lineItems[0].quantity).toBe(1000);
    await expect(repriceCart({ ...base, items: [{ slug: 'tracked', quantity: 3 }, { slug: 'tracked', quantity: 3 }] })).rejects.toThrow();
    await expect(repriceCart({ ...base, items: [{ slug: 'manufactured', quantity: -1 }] })).rejects.toThrow();
  });
});
