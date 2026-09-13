import { expect, test } from 'bun:test';
import { applyCommerce, merchantReleased } from '../src/lib/catalog/commerce';
import { shippingPrice } from '../src/lib/shipping';
import { calculatePromoDiscount } from '../src/lib/constants';
import { toStorefrontProduct } from '../src/lib/catalog/public-product';
import campaign from '../data/catalog/commerce-campaign.json';
import rows from '../data/catalog/generated-provider-products.json';
import type { CatalogProduct } from '../src/lib/catalog/types';
const products = rows as unknown as CatalogProduct[];
const start = Date.parse(campaign.startsAt);
test('sample removal and separate accessories', () => {
  expect(products).toHaveLength(355);
  expect(products.some(p => p.categorySlug === 'amostras' || /amostra|sample/i.test(p.name))).toBe(false);
  expect(products.filter(p => p.categorySlug === 'acessorios-instalacao')).toHaveLength(203);
  const nuralta = products.filter(p => p.supplierKey === 'nuralta');
  expect(nuralta).toHaveLength(3);
  expect(nuralta.find(p => p.slug === 'nuralta-painel-ripado-decorativo')?.variants).toHaveLength(21);
});
test('fixed 1/2/3h deadlines with some products undiscounted, no timer reset', () => {
  const panels = products.filter(p => p.categorySlug !== 'acessorios-instalacao');
  const priced = panels.map(p => applyCommerce(p, start + 1000));
  expect(priced.some(p => !p.promoDiscountPct)).toBe(true);
  expect(priced.some(p => p.promoDiscountPct)).toBe(true);
  for (const p of priced.filter(p => p.promoEndsAt)) {
    expect([3600000, 7200000, 10800000]).toContain(Date.parse(p.promoEndsAt!) - start);
    expect(applyCommerce(p, start + 2000).promoEndsAt).toBe(p.promoEndsAt);
    const ended = applyCommerce(p, Date.parse(p.promoEndsAt!));
    expect(ended.priceCents).toBe(p.regularPriceCents!);
    expect(ended.promoEndsAt).toBeNull();
  }
});
test('70% accessory campaign covers variants and ends October 1 Lisbon', () => {
  const raw = products.find(p => p.categorySlug === 'acessorios-instalacao' && p.priceCents > 0)!;
  const p = applyCommerce(raw, start + 1000);
  expect(p.priceCents).toBe(Math.round(raw.priceCents * .3));
  for (let i = 0; i < p.variants.length; i++) expect(p.priceCents + p.variants[i].priceDeltaCents).toBe(Math.round((raw.priceCents + raw.variants[i].priceDeltaCents) * .3));
  expect(applyCommerce(p, Date.parse(campaign.accessoriesEndsAt)).priceCents).toBe(raw.priceCents);
  const publicProduct = toStorefrontProduct(p);
  expect(applyCommerce(publicProduct, Date.parse(campaign.accessoriesEndsAt)).variants.map(v => v.priceDeltaCents)).toEqual(raw.variants.map(v => v.priceDeltaCents));
});
test('documentary metadata remains truthful; explicit blocks and zero prices remain blocked', () => {
  const p = products.find(p => p.priceCents > 0)!;
  expect(merchantReleased(p)).toBe(true);
  expect(applyCommerce(p).documentationStatus).toBe(p.documentationStatus);
  expect(merchantReleased({ ...p, complianceStatus: 'BLOCKED' })).toBe(false);
  expect(merchantReleased({ ...p, priceCents: 0 })).toBe(false);
});
test('Portugal/Spain free at every amount; Europe strictly above 50 after discounts', () => {
  for (const c of ['PT', 'ES']) { expect(shippingPrice(c, 1)).toBe(0); expect(shippingPrice(c, 1, 'express')).toBe(0); }
  expect(shippingPrice('FR', 50)).toBe(4.9);
  expect(shippingPrice('FR', 50.01)).toBe(0);
  expect(shippingPrice('FR', 49.99)).toBe(4.9);
  expect(shippingPrice('US', 100)).toBe(4.9);
});
test('coupons do not stack on automatic offers', () => {
  expect(calculatePromoDiscount([{ slug: 'a', price: '30', quantity: 1, automaticDiscountPct: 70 }, { slug: 'b', price: '20', quantity: 1 }], { type: 'percent', value: 10, label: 'Welcome' })).toBe(2);
});
