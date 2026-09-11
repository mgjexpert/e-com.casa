# Offers GEO contract

1. Read CDN country headers (`x-vercel-ip-country`, with safe fallbacks).
2. Resolve the code through the existing `src/lib/countries.ts` engine.
3. Use that engine for country, locale and currency context.
4. Derive the supported UI language from the resolved locale.
5. Preserve a customer-selected language preference instead of overriding it on each visit.
6. Never duplicate VAT, payment-method, checkout, stock or shipping rules inside Offers.

The first slatted-panel offer localizes its conversion-critical content for PT, EN, ES, FR, DE, IT and NL. Other supported countries safely use the language mapping/fallback provided by the shared market configuration while the commerce source of truth remains the central catalogue and checkout.
