// ============================================================
// E-com.casa — Payment configuration (SERVER ONLY)
// ------------------------------------------------------------
// Reads and validates the payment environment variables. This
// module must never be imported from client code — it touches
// secrets (xp_test_* / xp_live_*). Runtime validation returns
// safe, secret-free diagnostics only (§66).
// ============================================================

import 'server-only';

export type PaymentEnvironment = 'test' | 'live';

export interface PaymentConfig {
  environment: PaymentEnvironment;
  apiBaseUrl: string;
  /** Server credential — xp_test_* / xp_live_*. NEVER exposed. */
  secretKey: string | null;
  /** Webhook signing secret for the XPayments merchant webhook. NEVER exposed. */
  webhookSecret: string | null;
  /** Optional store/mid identifier for metadata — safe-ish, still server-only. */
  storeId: string | null;
  /** Stripe-compatible publishable key — safe for the browser. */
  publishableKey: string | null;
  /** Stripe-Version header preserved exactly as required by XPayments. */
  stripeApiVersion: string | null;
}

/** Pull config lazily so builds never crash on missing env. */
export function getPaymentConfig(): PaymentConfig {
  const rawEnv = (process.env.PAYMENT_ENVIRONMENT ?? 'test').toLowerCase();
  const environment: PaymentEnvironment = rawEnv === 'live' ? 'live' : 'test';

  return {
    environment,
    apiBaseUrl:
      process.env.XPAYMENTS_API_BASE_URL?.trim() ||
      'https://api.xpayments.digital/api/stripe/v1',
    secretKey: process.env.XPAYMENTS_SECRET_KEY?.trim() || null,
    webhookSecret: process.env.XPAYMENTS_WEBHOOK_SECRET?.trim() || null,
    storeId: process.env.XPAYMENTS_STORE_ID?.trim() || null,
    publishableKey:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null,
    stripeApiVersion: process.env.STRIPE_API_VERSION?.trim() || null,
  };
}

/** True when checkout can create real PaymentIntents. */
export function isPaymentConfigured(): boolean {
  const cfg = getPaymentConfig();
  return Boolean(cfg.secretKey && cfg.publishableKey);
}

export interface PaymentConfigIssue {
  field: string;
  problem: string;
}

/**
 * Validate the payment configuration. Returned issues contain field
 * names only — never secret values (§66).
 */
export function validatePaymentConfig(): PaymentConfigIssue[] {
  const cfg = getPaymentConfig();
  const issues: PaymentConfigIssue[] = [];

  if (!cfg.secretKey) {
    issues.push({ field: 'XPAYMENTS_SECRET_KEY', problem: 'missing' });
  } else if (
    cfg.environment === 'test' && !cfg.secretKey.startsWith('xp_test_') ||
    cfg.environment === 'live' && !cfg.secretKey.startsWith('xp_live_')
  ) {
    issues.push({
      field: 'XPAYMENTS_SECRET_KEY',
      problem: `expected an ${cfg.environment === 'live' ? 'xp_live_' : 'xp_test_'} credential for PAYMENT_ENVIRONMENT=${cfg.environment}`,
    });
  }

  if (!cfg.publishableKey) {
    issues.push({ field: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', problem: 'missing' });
  } else if (
    cfg.environment === 'live' && !cfg.publishableKey.startsWith('pk_live_') ||
    cfg.environment === 'test' && !(cfg.publishableKey.startsWith('pk_test_') || cfg.publishableKey.startsWith('pk_'))
  ) {
    issues.push({
      field: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      problem: `does not match PAYMENT_ENVIRONMENT=${cfg.environment}`,
    });
  }

  if (!cfg.webhookSecret) {
    issues.push({ field: 'XPAYMENTS_WEBHOOK_SECRET', problem: 'missing — webhook verification will reject every delivery' });
  }

  if (!process.env.XPAYMENTS_API_BASE_URL) {
    issues.push({ field: 'XPAYMENTS_API_BASE_URL', problem: 'unset — defaulting to the XPayments Stripe-compatible base URL' });
  }

  return issues;
}
