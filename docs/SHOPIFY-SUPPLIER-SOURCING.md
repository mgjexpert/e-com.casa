# E-com.casa — Shopify supplier sourcing

## Goal

Use public Shopify storefront data to accelerate supplier research without inventing stock, prices, reviews or product rights. The scanner uses only allow-listed supplier sites and Shopify's documented public Ajax Product endpoint (`/{locale}/products/{handle}.js`). It does not bypass logins, private APIs or access controls.

## Priority sources

### 1. Trendhero B.V. — Netherlands
- Store: https://www.trendhero.nl/en
- Powered by Shopify.
- B2B wholesale + dropshipping throughout Europe.
- Supplier states that stock is held in its own Netherlands warehouse and working-day dispatch is normally within 24 hours.
- Dropship orders can be entered into the supplier's dropshipping account; GoGetters and Everspring are also named integrations.
- Terms state that supplier photos/text/marketing materials remain Trendhero IP and may only be used for sale of Trendhero products.
- Trade pricing can require login, so public prices are research references until the E-com.casa B2B account is active.

**E-com.casa fit:** highest priority for EU fulfilment, especially artificial plants, vases, indoor decoration, planters and non-electrical accessories.

### 2. Viceni Limited — United Kingdom
- Store: https://www.viceni.com
- Powered by Shopify and explicitly trade-only.
- Wholesale prices are visible on many collection pages.
- No minimum order on the wholesale store; supplier invites retailers to discuss dropshipping.
- UK/Europe business operation and GPSR information are published.

**E-com.casa fit:** strong source for low-risk homeware, photo frames and decorative accessories. EU landed-cost/VAT/import treatment must be priced correctly because fulfilment may originate in the UK.

### 3. Chickidee Wholesale — United Kingdom
- Store: https://wholesale.chickidee.co.uk
- Powered by Shopify.
- Wholesale account approval is advertised as normally within 24 working hours.
- Approved trade accounts are offered free product photography for their own website/social channels.
- Dropshipping is offered through Shopify Collective for Shopify retailers.

**E-com.casa fit:** useful UK line and image-rights model; direct automation into the current Next.js/XPayments storefront requires a commercial route other than Shopify Collective or a separate supplier agreement.

### 4. WisFor
- Store: https://wisforhome.com
- Powered by Shopify.
- Public site states it supports wholesale and dropshipping and has warehouse coverage in the UK and multiple EU countries.

**E-com.casa fit:** secondary candidate, particularly mirrors and home furniture. Commercial pricing, product-media rights and EU product documentation must be confirmed before publication.

## Scanner

Run one source:

```bash
npm run catalog:shopify:scan -- trendhero
npm run catalog:shopify:scan -- viceni
```

Run all allow-listed sources:

```bash
npm run catalog:shopify:scan:all
```

Output is written to:

`data/catalog/shopify-research/<source>.json`

A limited, read-only production diagnostic is also available:

`GET /api/internal/catalog/shopify-scan?source=trendhero&limit=12`

The endpoint only accepts the hard-coded supplier IDs and never writes to the database.

## Data we trust from public Shopify

The scanner can capture:
- product ID and handle;
- title, vendor and product type;
- description and tags;
- public/current presentment price;
- variant availability boolean;
- SKUs/barcodes when exposed by the storefront;
- real Shopify CDN product images.

The scanner deliberately does **not** claim:
- numeric inventory quantity;
- wholesale cost when the supplier hides it behind a trade login;
- reseller/media rights;
- GPSR/CE/WEEE/manufacturer documentation unless separately evidenced;
- review/rating counts.

## Publication gate

A Shopify-sourced product must not become payable until all of the following are true:

1. supplier relationship / right to resell is active;
2. dropship or fulfilment route is agreed;
3. product photography/media usage is permitted;
4. cost and sell price are known in the checkout currency;
5. supplier availability is current;
6. manufacturer / responsible-person / GPSR information required for the destination market is present;
7. `isDemo=false`;
8. `requiresComplianceReview=false`;
9. `complianceStatus` and `documentationStatus` are no longer pending/demo/blocked.

The checkout server enforces these gates, so research or supplier-staged products cannot accidentally create an XPayments charge.
