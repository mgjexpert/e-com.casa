export interface ProductOffer {
  productSlug: string;
  slug: string;
  enabled: boolean;
  discountPct: number | null;
  fixedPriceCents: number | null;
  startsAt: string;
  endsAt: string;
  version: number;
}
export function isOfferActive(offer: ProductOffer | null | undefined, now = Date.now()): offer is ProductOffer {
  return Boolean(offer?.enabled && now >= Date.parse(offer.startsAt) && now < Date.parse(offer.endsAt));
}
export function validateProductOffer(offer: ProductOffer) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(offer.slug)) throw Error('Invalid offer slug');
  const pct = offer.discountPct !== null;
  const fixed = offer.fixedPriceCents !== null;
  if (pct === fixed) throw Error('Choose either percentage or fixed price');
  if (pct && (!Number.isInteger(offer.discountPct) || offer.discountPct! < 1 || offer.discountPct! > 99)) throw Error('Percentage must be 1–99');
  if (fixed && (!Number.isInteger(offer.fixedPriceCents) || offer.fixedPriceCents! < 1)) throw Error('Fixed price must be positive integer cents');
  if (!Number.isFinite(Date.parse(offer.startsAt)) || !Number.isFinite(Date.parse(offer.endsAt)) || Date.parse(offer.endsAt) <= Date.parse(offer.startsAt)) throw Error('Invalid campaign dates');
}
