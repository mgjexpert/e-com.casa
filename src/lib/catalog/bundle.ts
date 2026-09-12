import { applyCommerce, isAccessory } from './commerce';
import type { CatalogProduct } from './types';
import campaign from '../../../data/catalog/commerce-campaign.json';
/** September order benefit: a main product qualifies accessories for 75%, never stacked. */
export function applyBundleOffer(product: CatalogProduct, cart: CatalogProduct[], now = Date.now()): CatalogProduct {
  const current = applyCommerce(product, now);
  const eligible = isAccessory(current) && cart.some(p=>!isAccessory(p) && p.priceCents > 0 && p.canPurchase !== false);
  if (!eligible || now < Date.parse(campaign.startsAt) || now >= Date.parse(campaign.accessoriesEndsAt)) return current;
  const base = current.regularPriceCents ?? current.priceCents;
  const cents = Math.round(base*.25);
  if (current.priceCents <= cents) return current;
  return { ...current, priceCents:cents, price:(cents/100).toFixed(2), promoDiscountPct:75, promoEndsAt:campaign.accessoriesEndsAt, variants: current.variants.map(v=>({...v,priceDeltaCents:Math.round((base+(v.regularPriceDeltaCents??v.priceDeltaCents))*.25)-cents})) };
}
export function rankAccessories(products: CatalogProduct[], cart: CatalogProduct[]): CatalogProduct[] {
  const brands = new Set(cart.filter(p=>!isAccessory(p)).map(p=>p.brand?.toLowerCase()).filter(Boolean));
  return [...products].sort((a,b)=>Number(brands.has(b.brand?.toLowerCase()))-Number(brands.has(a.brand?.toLowerCase())) || a.name.localeCompare(b.name));
}
