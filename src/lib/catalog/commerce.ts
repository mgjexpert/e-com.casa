import { isOfferActive } from '../offers/promotion';
import campaign from '../../../data/catalog/commerce-campaign.json';
import type { CatalogProduct } from './types';
export const ACCESSORY_CATEGORIES = ['acessorios', 'produtos-instalacao', 'acessorios-divisorias', 'acessorios-instalacao'];
export const isAccessory = (p: Pick<CatalogProduct, 'categorySlug'> & { name?: string; slug?: string }) => ACCESSORY_CATEGORIES.includes(p.categorySlug) || /acessórios|ripa de fixação/i.test(p.name ?? '');
export const isSample = (p: Pick<CatalogProduct, 'categorySlug'> & { name?: string; slug?: string }) => p.categorySlug === 'amostras' || /\b(amostras?|samples?)\b/i.test(p.name ?? '');
function hash(value: string) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** One fixed campaign; neither visits nor daily supplier sync restart its deadlines. */
export function applyCommerce(product: CatalogProduct, now = Date.now()): CatalogProduct {
  const seed = hash(`${campaign.id}:${product.slug}`);
  const accessory = isAccessory(product);
  const starts = Date.parse(campaign.startsAt);
  let ends = accessory ? Date.parse(campaign.accessoriesEndsAt) : starts + (1 + seed % 3) * 3600000;
  let pct = accessory ? 70 : seed % 4 === 0 ? 0 : [10, 15, 20][seed % 3];
  const base = product.regularPriceCents ?? product.priceCents;
  const funnel = isOfferActive(product.funnelOffer, now) ? product.funnelOffer : null;
  const fixed = funnel?.fixedPriceCents ?? null;
  if (funnel) { ends = Date.parse(funnel.endsAt); pct = funnel.discountPct ?? Math.round((1 - fixed! / base) * 100); }
  const active = base > 0 && pct > 0 && (funnel !== null || now >= starts) && now < ends;
  const factor = active ? (100 - pct) / 100 : 1;
  const cents = active && fixed !== null ? fixed : Math.round(base * factor);
  return {
    ...product,
    regularPriceCents: base,
    offerSlug: funnel?.slug ?? null,
    priceCents: cents, price: (cents / 100).toFixed(2),
    comparePrice: null,
    promoDiscountPct: active ? pct : null,
    promoEndsAt: active ? new Date(ends).toISOString() : null,
    variants: product.variants.map(v => {
      const delta = v.regularPriceDeltaCents ?? v.priceDeltaCents ?? 0;
      return { ...v, regularPriceDeltaCents: delta, priceDeltaCents: active && fixed !== null ? delta : Math.round((base + delta) * factor) - cents };
    }),
  };
}

export function merchantReleased(product: { supplierKey?: string | null; priceCents?: number; complianceStatus?: string; documentationStatus?: string; isDemo?: boolean }): boolean {
  return !product.isDemo && campaign.merchantRelease.suppliers.includes(product.supplierKey ?? '')
    && (product.priceCents ?? 0) > 0
    && !['BLOCKED', 'DEMO'].includes(String(product.complianceStatus).toUpperCase())
    && !['BLOCKED', 'DEMO'].includes(String(product.documentationStatus).toUpperCase());
}
