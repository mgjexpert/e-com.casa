# Offers reference implementation notes

## Commercial reference

The first Offer (`/offers/painel-ripado`) follows the conversion structure observed on the Nuralta Interiores slatted-panel storefront as a behavioural/layout reference: focused hero, product choices, price/quantity, direct CTA, delivery/trust messaging, manufacturing/value story position, technical details, installation, transformation/inspiration, social proof, reviews, objection-handling FAQ and mobile purchase CTA.

## Intellectual-property boundary

E-com.casa does **not** copy Nuralta source code, brand identity, customer reviews, customer names, product photography, proprietary videos or literal marketing copy. The renderer is original E-com.casa code and styling. Video slots use separately licensed/free-to-use editorial stock footage and carry a visible disclaimer when footage is not the exact catalogue SKU.

## GEO / internationalization

Offer market context resolves CDN/Vercel country headers and then delegates locale/currency/market configuration to `src/lib/countries.ts`. Existing customer language preference remains authoritative after selection. Offers do not create a second country, pricing, stock, checkout or payment engine.

## Commercial source of truth

Price, SKU, variants, availability, cart, checkout and XPayments continue to come from the E-com.casa catalogue and commerce stack. Staged/non-approved products remain non-purchasable. Visual review modules never become factual structured data unless reviews are verified.
