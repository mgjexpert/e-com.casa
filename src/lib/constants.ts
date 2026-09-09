// ============================================================
// E-com.casa — central commerce configuration
// Prices are VAT-inclusive for consumers (EU display rule).
// VAT configuration object: rates are REFERENCE values and
// must be validated per market before go-live.
// ============================================================

export interface CountryConfig {
  code: string;
  name: string;
  vatRate: number; // reference standard rate — validate before go-live
  currency: string;
  market: 'EU' | 'UK';
}

export const COUNTRIES: CountryConfig[] = [
  { code: 'PT', name: 'Portugal', vatRate: 23, currency: 'EUR', market: 'EU' },
  { code: 'ES', name: 'Spain', vatRate: 21, currency: 'EUR', market: 'EU' },
  { code: 'FR', name: 'France', vatRate: 20, currency: 'EUR', market: 'EU' },
  { code: 'DE', name: 'Germany', vatRate: 19, currency: 'EUR', market: 'EU' },
  { code: 'IT', name: 'Italy', vatRate: 22, currency: 'EUR', market: 'EU' },
  { code: 'NL', name: 'Netherlands', vatRate: 21, currency: 'EUR', market: 'EU' },
  { code: 'BE', name: 'Belgium', vatRate: 21, currency: 'EUR', market: 'EU' },
  { code: 'AT', name: 'Austria', vatRate: 20, currency: 'EUR', market: 'EU' },
  { code: 'IE', name: 'Ireland', vatRate: 23, currency: 'EUR', market: 'EU' },
  { code: 'DK', name: 'Denmark', vatRate: 25, currency: 'EUR', market: 'EU' },
  { code: 'SE', name: 'Sweden', vatRate: 25, currency: 'EUR', market: 'EU' },
  { code: 'FI', name: 'Finland', vatRate: 25.5, currency: 'EUR', market: 'EU' },
  { code: 'GB', name: 'United Kingdom', vatRate: 20, currency: 'GBP', market: 'UK' },
];

// Shipping — placeholder configuration, confirmed at logistics setup
export const FREE_SHIPPING_THRESHOLD = 50.0; // EUR — placeholder
export const SHIPPING_OPTIONS = [
  {
    id: 'standard',
    name: 'Standard delivery',
    description: '3–5 working days', // EU_STANDARD_DELIVERY_DAYS placeholder
    price: 4.9,
  },
  {
    id: 'express',
    name: 'Express delivery',
    description: '1–2 working days',
    price: 9.9,
  },
] as const;

export const PROMO_CODES: Record<string, { type: 'percent'; value: number; label: string }> = {
  WELCOME10: { type: 'percent', value: 10, label: '10% welcome discount' },
  HOME5: { type: 'percent', value: 5, label: '5% off your order' },
};

// Gift wrap service — flat fee added at checkout (never discounted by promos)
export const GIFT_WRAP_PRICE = 3.9; // EUR
export const ORDER_NOTES_MAX = 500;

export const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'PT', label: 'Português' },
  { code: 'FR', label: 'Français' },
  { code: 'DE', label: 'Deutsch' },
  { code: 'ES', label: 'Español' },
  { code: 'IT', label: 'Italiano' },
  { code: 'NL', label: 'Nederlands' },
];

export const SEARCH_SUGGESTIONS = [
  'wall panels',
  'lighting',
  'garden',
  'balcony',
  'mirrors',
  'planters',
  'outdoor lighting',
];

// Simple country rule engine scaffold — extend per market requirements
export function getCountryRequirements(countryCode: string) {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  const isUK = country?.market === 'UK';
  return {
    withdrawalDays: 14,
    legalGuaranteeYears: country && !isUK ? 2 : null, // EU minimum; UK: statutory rights
    currency: country?.currency ?? 'EUR',
    vatRate: country?.vatRate ?? null,
    market: country?.market ?? 'EU',
    complaintBookUrl: countryCode === 'PT' ? 'https://www.livroreclamacoes.pt/' : null,
    mediator: countryCode === 'FR' ? '[MÉDIATEUR DE LA CONSOMMATION À DÉSIGNER]' : null,
  };
}
