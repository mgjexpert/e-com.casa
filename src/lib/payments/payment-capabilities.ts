// ============================================================
// E-com.casa — Payment capabilities resolver (§47)
// ------------------------------------------------------------
// Server-side resolution of bookable payment methods for a
// country/currency pair. The gateway configuration stays
// authoritative where possible; a static logo never implies
// availability (§62, §94).
// ============================================================

import 'server-only';
import { isPaymentConfigured } from './payments-config';
import { getPaymentMethodsForCountry } from './payment-methods';
import type { PaymentMethodCapability } from './payment-types';

export function resolvePaymentCapabilities(
  country: string,
  currency: string,
): { methods: PaymentMethodCapability[]; providerConfigured: boolean; environment: 'test' | 'live' } {
  const providerConfigured = isPaymentConfigured();
  const methods = getPaymentMethodsForCountry(country, currency, { providerConfigured });
  return { methods, providerConfigured, environment: process.env.PAYMENT_ENVIRONMENT === 'live' ? 'live' : 'test' };
}

/**
 * Payment currency for a checkout country. Resolved through the
 * country engine configuration (never hardcoded EUR), validated
 * against the currencies our payment account can process.
 */
export function resolvePaymentCurrency(countryCurrency: string): { currency: string; supported: boolean } {
  const currency = (countryCurrency || 'EUR').toUpperCase();
  const supported = ['EUR', 'GBP', 'DKK', 'SEK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN'].includes(currency);
  return { currency, supported };
}
