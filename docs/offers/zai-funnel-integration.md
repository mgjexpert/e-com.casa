# Z.AI funnel integration

Source prototype: `nexflowx-hub/nuraltainteriores` at commit `6f5f2e45277452be34eaadc1c7726465a031f4c3`.

## Decision

The prototype is **not** embedded as an iframe, submodule or second Next.js application. Its visual funnel patterns are integrated into the existing E-com.casa Offers Engine.

## Imported conceptually

- product-first two-column hero
- sticky product gallery with previous/next controls and thumbnails
- warm neutral visual system
- product configurator hierarchy
- quantity and purchase hierarchy
- delivery/trust block
- pricing/story section
- transformation/storytelling section
- numbered technical accordions
- inspiration gallery
- reviews area
- numbered FAQ
- mobile sticky CTA

## Deliberately not imported

- the prototype `.env` and SQLite database
- its Prisma schema and API routes
- Z.AI build/runtime scripts
- duplicated shadcn/UI library
- prototype PWA/SEO root files
- Nuralta branding, legal copy and institutional identity
- hard-coded €5/€9/€13 prices
- claims of factory-direct manufacturing
- fixed CTT delivery claims
- hard-coded customer identities/reviews
- third-party/reference media as if it were verified customer content

## Production source of truth

- product: E-com.casa catalog resolver
- public browser payload: `toStorefrontProduct()`
- saleability: server-computed `canPurchase`
- variants/pricing/stock: E-com.casa catalog
- cart: E-com.casa cart store
- checkout: `/checkout`
- attribution/analytics: Offers Engine
- company/legal: `src/lib/company.ts`
- review schema: only verified reviews may become structured SEO data

## Route

`/offers/painel-ripado`

The integrated presentation component is `src/components/offers/offer-page-zai.tsx`.
