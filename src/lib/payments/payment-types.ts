// ============================================================
// E-com.casa — Payment domain types
// ------------------------------------------------------------
// Shared, framework-agnostic types for the payment architecture.
// The browser may import types from here — never secrets.
// ============================================================

/** Payment service providers wired into the checkout. */
export type PaymentProviderName = 'xpayments_stripe';

/**
 * Payment method identifiers. Values are stable and used in
 * order records, webhooks and the capabilities API.
 */
export type PaymentMethodType =
  | 'card'
  | 'mb_way'
  | 'multibanco'
  | 'bizum'
  | 'blik'
  | 'bancontact'
  | 'apple_pay'
  | 'google_pay'
  | 'link'
  | 'paypal'
  | 'pix'
  | 'other';

/**
 * Payment lifecycle — mirrors the gateway PaymentIntent states,
 * normalised for E-com.casa. Persisted on Payment.status.
 */
export type PaymentStatus =
  | 'CREATED'
  | 'REQUIRES_PAYMENT_METHOD'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

/**
 * Order-level payment state. Kept strictly separate from the
 * fulfilment `status` (CONFIRMED | PROCESSING | SHIPPED | …).
 * Only a verified server-side gateway confirmation may set PAID.
 */
export type OrderPaymentStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

/** Monotonic ranking used by the webhook handler so late, stale
 *  events can never downgrade an order (PAID → PENDING is impossible). */
export const PAYMENT_STATUS_RANK: Record<string, number> = {
  PENDING_PAYMENT: 0,
  PAYMENT_PROCESSING: 1,
  PAYMENT_FAILED: 1,
  CANCELLED: 1,
  PAID: 2,
  PARTIALLY_REFUNDED: 3,
  REFUNDED: 4,
};

/** Normalised, customer-safe error codes (§68). Raw gateway payloads
 *  are never surfaced to shoppers. */
export type PaymentErrorCode =
  | 'PAYMENT_METHOD_UNAVAILABLE'
  | 'PAYMENT_REQUIRES_ACTION'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_CONFIGURATION_ERROR'
  | 'TEMPORARY_PAYMENT_ERROR'
  | 'PAYMENT_ORDER_NOT_FOUND'
  | 'PAYMENT_UNAUTHORIZED'
  | 'PAYMENT_ALREADY_PAID';

/** Result envelope for provider calls. */
export interface ProviderPaymentIntent {
  id: string;
  clientSecret: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  paymentMethodType: string | null;
  /** Raw provider response is logged server-side only — never returned to the browser. */
  raw?: unknown;
}

export interface CreatePaymentIntentInput {
  /** Amount in the smallest currency unit (e.g. 4990 = €49.90). */
  amountMinor: number;
  /** ISO 4217 uppercase, e.g. EUR. */
  currency: string;
  /** Stable idempotency key — `ecom-order-<orderNumber>` style. */
  idempotencyKey: string;
  orderNumber: string;
  customerCountry: string;
  customerEmail?: string;
  /** Human-readable statement descriptor segment (≤22 chars). */
  description?: string;
  metadata?: Record<string, string>;
}

/** Webhook verification outcome. Fail-closed: only `verified` events
 *  are ever processed. */
export type WebhookVerification =
  | { ok: true }
  | { ok: false; reason: string };

/** Normalise a raw gateway intent status (Stripe-shaped, e.g.
 *  "requires_payment_method") onto the E-com.casa PaymentStatus. */
export function normaliseGatewayIntentStatus(raw: string | undefined | null): PaymentStatus {
  switch (raw) {
    case 'succeeded': return 'SUCCEEDED';
    case 'processing': return 'PROCESSING';
    case 'requires_payment_method': return 'REQUIRES_PAYMENT_METHOD';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_capture': return 'REQUIRES_ACTION';
    case 'canceled':
    case 'cancelled': return 'CANCELLED';
    case 'REFUNDED': return 'REFUNDED';
    case 'PARTIALLY_REFUNDED': return 'PARTIALLY_REFUNDED';
    case 'FAILED': return 'FAILED';
    default: return 'CREATED';
  }
}

/** Public capabilities payload returned by /api/payments/capabilities. */
export interface PaymentMethodCapability {
  method: PaymentMethodType;
  enabled: boolean;
  /** Configuration rules (country/currency) allow offering this method. */
  geographicallyEligible: boolean;
  displayName: string;
  /** `static` logos come from the supplied brand assets; `dynamic`
   *  methods (Apple Pay, Google Pay, Link, PayPal) are rendered by
   *  Stripe's Express Checkout Element and have no static logo. */
  logo: string | null;
  logoKind: 'static' | 'dynamic';
  /** Optional individual brand marks for methods whose single logo is a
   *  combined card artwork (e.g. Visa / Mastercard / American Express
   *  cropped from the same supplied asset). Display-only. */
  brandLogos?: Array<{ src: string; alt: string }>;
  countryAvailability: readonly string[];
  currencyAvailability: readonly string[];
  providerAvailability: boolean;
  sortOrder: number;
}

/** Minimal shape of a Stripe-shaped PaymentIntent we rely on. */
export interface StripeLikeIntent {
  id?: string;
  client_secret?: string | null;
  status?: string;
  amount?: number;
  currency?: string;
  payment_method_types?: string[];
  payment_method?: string | { type?: string } | null;
  last_payment_error?: { code?: string; message?: string } | null;
  next_action?: unknown;
}

/** Payload the frontend needs to initialise Stripe Elements. */
export interface ClientPaymentSession {
  publishableKey: string;
  paymentIntentId: string;
  clientSecret: string;
  currency: string;
  amountMinor: number;
  orderNumber: string;
  environment: 'test' | 'live';
  methods: PaymentMethodCapability[];
}
