// ============================================================
// E-com.casa — Checkout server engine (§5, §11, §39)
// ------------------------------------------------------------
// Server-side cart validation and repricing. Client totals are
// NEVER trusted. Also owns the pricing fingerprint (pricingHash)
// that keeps the PaymentIntent amount in sync with the order.
// ============================================================

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getProduct } from '@/lib/catalog';
import {
  SHIPPING_OPTIONS,
  FREE_SHIPPING_THRESHOLD,
  PROMO_CODES,
  GIFT_WRAP_PRICE,
  ORDER_NOTES_MAX,
} from '@/lib/constants';
import { getCountryConfiguration } from '@/lib/countries';

export interface CheckoutItemInput {
  slug: string;
  quantity: number;
  variantId?: string | null;
}

export interface RepricedTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  giftWrapFee: number;
  total: number;
  promoCode: string | null;
  lineItems: {
    slug: string;
    name: string;
    subtitle?: string | null;
    price: string;
    quantity: number;
    image: string;
    variantLabel?: string | null;
    variantId?: string | null;
  }[];
  /** Stable fingerprint of everything that influences the payable amount. */
  pricingHash: string;
  currency: string;
  country: string;
}

export function newOrderNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `EC-${random}`;
}

export function newAccessToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Reprice a cart entirely server-side from catalogue data.
 * Returns null-safe errors via thrown CheckoutValidationError.
 */
export class CheckoutValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function repriceCart(input: {
  items: CheckoutItemInput[];
  country: string;
  shippingMethod: string;
  promoCode?: string | null;
  giftWrap?: boolean;
}): Promise<RepricedTotals> {
  const slugs = input.items.map((i) => i.slug);
  const resolved = await Promise.all(slugs.map((s) => getProduct(s)));
  const products = resolved.filter((p): p is NonNullable<typeof p> => Boolean(p));
  const missing = slugs.filter((s) => !products.some((p) => p.slug === s));
  if (missing.length > 0) {
    throw new CheckoutValidationError('One or more products are unavailable');
  }

  // Research, supplier-staged and compliance-pending rows may exist in the
  // catalogue for merchandising/review continuity, but they can never create
  // a payable order. A product becomes saleable only after supplier/media
  // rights and product documentation/compliance have been explicitly cleared.
  const blockedCompliance = new Set(['DEMO', 'BLOCKED', 'PENDING', 'PENDING_REVIEW', 'SUPPLIER_PENDING']);
  const blockedDocumentation = new Set(['DEMO', 'PENDING', 'PENDING_REVIEW', 'MISSING']);
  const nonSaleable = products.find((product) =>
    product.isDemo
    || product.requiresComplianceReview
    || blockedCompliance.has(String(product.complianceStatus || '').toUpperCase())
    || blockedDocumentation.has(String(product.documentationStatus || '').toUpperCase()),
  );
  if (nonSaleable) {
    throw new CheckoutValidationError(
      `“${nonSaleable.name}” is still being validated for sale and is not available for purchase yet.`,
      409,
    );
  }

  // Oversell guard — stock is NOT decremented here (§39): the final
  // decrement happens only after verified payment.
  for (const item of input.items) {
    const product = products.find((p) => p.slug === item.slug)!;
    if (product.stock < item.quantity || product.availability === 'outOfStock') {
      throw new CheckoutValidationError(
        product.stock <= 0 || product.availability === 'outOfStock'
          ? `Sorry — “${product.name}” has just sold out.`
          : `Sorry — only ${product.stock} × “${product.name}” remain in stock.`,
        409,
      );
    }
  }

  let subtotal = 0;
  const lineItems = input.items.map((item) => {
    const product = products.find((p) => p.slug === item.slug)!;
    let variantDeltaCents = 0;
    let variantLabel: string | undefined;
    if (item.variantId) {
      const v = product.variants.find((x) => x.id === item.variantId);
      if (v) {
        variantDeltaCents = v.priceDeltaCents ?? 0;
        variantLabel = v.name;
      }
    }
    const priceCents =
      (product.priceCents ?? Math.round(parseFloat(product.price) * 100)) + variantDeltaCents;
    const price = (priceCents / 100).toFixed(2);
    subtotal += (priceCents / 100) * item.quantity;
    return {
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle,
      price,
      quantity: item.quantity,
      image: product.image,
      variantLabel,
      variantId: item.variantId ?? null,
    };
  });

  let discount = 0;
  let appliedPromo: string | null = null;
  if (input.promoCode && PROMO_CODES[input.promoCode.toUpperCase()]) {
    const promo = PROMO_CODES[input.promoCode.toUpperCase()];
    discount = (subtotal * promo.value) / 100;
    appliedPromo = input.promoCode.toUpperCase();
  }

  const option = SHIPPING_OPTIONS.find((o) => o.id === input.shippingMethod) ?? SHIPPING_OPTIONS[0];
  const shippingCost =
    subtotal - discount >= FREE_SHIPPING_THRESHOLD && option.id === 'standard' ? 0 : option.price;
  const giftWrapFee = input.giftWrap ? GIFT_WRAP_PRICE : 0;
  const total = subtotal - discount + shippingCost + giftWrapFee;

  // Country engine decides the charge currency (never hardcoded EUR — §13).
  const countryCfg = getCountryConfiguration(input.country);
  const currency = countryCfg?.currency ?? 'EUR';

  const pricingHash = createHash('sha256')
    .update(
      JSON.stringify({
        items: input.items,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        shipping: shippingCost.toFixed(2),
        giftWrap: giftWrapFee.toFixed(2),
        total: total.toFixed(2),
        currency,
      }),
    )
    .digest('hex')
    .slice(0, 32);

  return {
    subtotal,
    discount,
    shipping: shippingCost,
    giftWrapFee,
    total,
    promoCode: appliedPromo,
    lineItems,
    pricingHash,
    currency,
    country: input.country.toUpperCase(),
  };
}

/** Strip HTML tags and control characters — notes are plain text. */
export function sanitizeNotes(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, ORDER_NOTES_MAX);
}

/**
 * Constant-time comparison of the order access token. Prevents
 * timing oracles on order lookups (§60).
 */
export function tokenMatches(stored: string | null | undefined, provided: string | null | undefined): boolean {
  if (!stored || !provided) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  // length check above leaks length only — acceptable for random hex tokens
  return timingSafeEqual(a, b);
}
