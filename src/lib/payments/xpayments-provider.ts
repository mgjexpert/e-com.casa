// ============================================================
// E-com.casa — XPayments Stripe-compatible provider (§2, §22)
// ------------------------------------------------------------
// Server-side implementation of the PaymentProvider contract on
// top of the XPayments Stripe-compatible Direct API:
//
//   POST {base}/payment_intents          (application/x-www-form-urlencoded)
//   Authorization: Bearer xp_test_* / xp_live_*
//   Idempotency-Key: <stable key>        (always preserved)
//   Stripe-Version: <configured>         (preserved when set)
//
// References:
//   https://www.xpayments.digital/doc/stripe
//
// SECURITY:
//   - This module is server-only ('server-only' import below).
//   - The xp_* secret key never leaves this module, is never
//     logged, and is never sent to the browser.
//   - Webhook verification is fail-closed and uses the merchant
//     webhook secret (XPAYMENTS_WEBHOOK_SECRET). The exact signing
//     scheme must match the merchant contract; every supported
//     scheme below is timing-safe and unverified events are
//     rejected (§36, §88).
// ============================================================

import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { getPaymentConfig, type PaymentConfig } from './payments-config';
import { normaliseGatewayError, PaymentError, toPaymentError } from './payment-errors';
import type {
  CreatePaymentIntentInput,
  PaymentStatus,
  ProviderPaymentIntent,
  StripeLikeIntent,
  WebhookVerification,
} from './payment-types';
import type { PaymentProvider } from './payment-provider';

function normaliseStatus(raw: string | undefined): PaymentStatus {
  switch (raw) {
    case 'succeeded': return 'SUCCEEDED';
    case 'processing': return 'PROCESSING';
    case 'requires_payment_method': return 'REQUIRES_PAYMENT_METHOD';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_capture': return 'REQUIRES_ACTION';
    case 'canceled':
    case 'cancelled': return 'CANCELLED';
    default: return 'CREATED';
  }
}

function toProviderIntent(intent: StripeLikeIntent): ProviderPaymentIntent {
  const pm = intent.payment_method;
  const methodType =
    typeof pm === 'string' ? null : pm?.type ?? null;
  return {
    id: String(intent.id ?? ''),
    clientSecret: intent.client_secret ?? null,
    status: normaliseStatus(intent.status),
    amountMinor: Number(intent.amount ?? 0),
    currency: String(intent.currency ?? '').toUpperCase(),
    paymentMethodType: methodType,
    raw: intent,
  };
}

/** x-www-form-urlencoded body builder supporting bracketed keys. */
function formEncode(fields: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params.toString();
}

export class XPaymentsStripeProvider implements PaymentProvider {
  readonly name = 'xpayments_stripe';
  private readonly cfg: PaymentConfig;

  constructor(cfg: PaymentConfig = getPaymentConfig()) {
    this.cfg = cfg;
  }

  private headers(idempotencyKey?: string, includeContentType = true): Record<string, string> {
    if (!this.cfg.secretKey) {
      throw new PaymentError('PAYMENT_CONFIGURATION_ERROR', 503, 'missing_secret');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.secretKey}`,
    };
    if (includeContentType) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (this.cfg.stripeApiVersion) headers['Stripe-Version'] = this.cfg.stripeApiVersion;
    return headers;
  }

  private base(): string {
    return this.cfg.apiBaseUrl.replace(/\/+$/, '');
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: string; idempotencyKey?: string; contentType?: boolean } = {},
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base()}${path}`, {
        method,
        headers: this.headers(opts.idempotencyKey, opts.contentType ?? method === 'POST'),
        body: method === 'POST' ? opts.body : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw toPaymentError(error);
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text.slice(0, 500) };
    }

    if (!res.ok) {
      throw normaliseGatewayError(res.status, parsed);
    }
    return parsed as T;
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const metadata: Record<string, string | number> = {
      'metadata[order_number]': input.orderNumber,
      'metadata[customer_country]': input.customerCountry,
      'metadata[store]': 'e-com.casa',
      ...(this.cfg.storeId ? { 'metadata[store_id]': this.cfg.storeId } : {}),
      ...(input.metadata ?? {}),
    };
    const body = formEncode({
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      'automatic_payment_methods[enabled]': 'true',
      description: input.description ?? `E-com.casa order ${input.orderNumber}`,
      ...(input.customerEmail ? { receipt_email: input.customerEmail } : {}),
      ...metadata,
    });

    const intent = await this.request<StripeLikeIntent>('POST', '/payment_intents', {
      body,
      idempotencyKey: input.idempotencyKey,
    });
    return toProviderIntent(intent);
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<ProviderPaymentIntent> {
    const intent = await this.request<StripeLikeIntent>('GET', `/payment_intents/${encodeURIComponent(paymentIntentId)}`);
    return toProviderIntent(intent);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<ProviderPaymentIntent> {
    const intent = await this.request<StripeLikeIntent>('POST', `/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`, {
      body: '',
      idempotencyKey: `ecom-cancel-${paymentIntentId}`,
    });
    return toProviderIntent(intent);
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<ProviderPaymentIntent> {
    const intent = await this.request<StripeLikeIntent>('POST', `/payment_intents/${encodeURIComponent(paymentIntentId)}/capture`, {
      body: '',
      idempotencyKey: `ecom-capture-${paymentIntentId}`,
    });
    return toProviderIntent(intent);
  }

  async refundPayment(
    paymentIntentId: string,
    amountMinor?: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    const refund = await this.request<{ id?: string; status?: string }>('POST', '/refunds', {
      body: formEncode({
        payment_intent: paymentIntentId,
        amount: amountMinor,
        reason: reason ? mapRefundReason(reason) : undefined,
      }),
      idempotencyKey: `ecom-refund-${paymentIntentId}-${amountMinor ?? 'full'}`,
    });
    return { refundId: String(refund.id ?? ''), status: String(refund.status ?? 'pending') };
  }

  /**
   * Verify a webhook delivery against the merchant contract (§36).
   *
   * XPayments documents a merchant webhook with HMAC signing; the
   * exact header layout must be confirmed with the merchant account.
   * Supported timing-safe schemes (fail-closed):
   *   1. `X-Webhook-Signature: sha256=<hex(hmac_sha256(secret, rawBody))>`
   *      (also accepted on `X-Xpayments-Signature`)
   *   2. Stripe-style `t=<ts>,v1=<hex>` over `<ts>.<rawBody>`
   *      (also accepted on `Stripe-Signature`) — replay window 5 min.
   * If no signature header is present at all the delivery is rejected.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification {
    if (!this.cfg.webhookSecret) {
      return { ok: false, reason: 'webhook secret not configured' };
    }
    const h = (name: string) =>
      headers[name] ?? headers[name.toLowerCase()] ?? undefined;

    const signature =
      h('x-webhook-signature') ?? h('x-xpayments-signature') ?? h('stripe-signature');
    if (!signature) {
      return { ok: false, reason: 'missing signature header' };
    }

    const secret = Buffer.from(this.cfg.webhookSecret, 'utf8');

    // Scheme 2: Stripe-style t=…,v1=… over "<ts>.<body>"
    const stripeMatch = /t=(\d+)[,v=]*.*?v1=([0-9a-f]+)/i.exec(signature);
    if (stripeMatch) {
      const ts = Number(stripeMatch[1]);
      const age = Math.abs(Date.now() / 1000 - ts);
      if (!Number.isFinite(ts) || age > 300) {
        return { ok: false, reason: 'signature timestamp outside replay window' };
      }
      const expected = createHmac('sha256', secret).update(`${stripeMatch[1]}.${rawBody}`).digest('hex');
      if (safeEqualHex(expected, stripeMatch[2])) return { ok: true };
      return { ok: false, reason: 'signature mismatch' };
    }

    // Scheme 1: plain sha256=<hex> over the raw body
    const plain = /^sha256=([0-9a-f]+)$/i.exec(signature.trim());
    if (plain) {
      const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
      if (safeEqualHex(expected, plain[1])) return { ok: true };
      return { ok: false, reason: 'signature mismatch' };
    }

    return { ok: false, reason: 'unsupported signature scheme' };
  }

  getPaymentCapabilities() {
    return {
      provider: this.name,
      configured: Boolean(this.cfg.secretKey && this.cfg.publishableKey),
      environment: this.cfg.environment,
    };
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a.toLowerCase(), 'utf8');
  const bb = Buffer.from(b.toLowerCase(), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

function mapRefundReason(reason: string): string | undefined {
  const r = reason.toLowerCase();
  if (r.includes('duplicate')) return 'duplicate';
  if (r.includes('fraud')) return 'fraudulent';
  if (r.includes('requested') || r.includes('return')) return 'requested_by_customer';
  return undefined;
}

/** Singleton accessor — the app never constructs other providers. */
let providerInstance: XPaymentsStripeProvider | null = null;
export function getPaymentProvider(): XPaymentsStripeProvider {
  if (!providerInstance) providerInstance = new XPaymentsStripeProvider();
  return providerInstance;
}
