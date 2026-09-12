# Product funnels and merchant prices

Supplier catalogue and merchant campaign settings are separate. PostgreSQL `ProductOffer` owns a stable `/offers/{slug}` URL, `enabled`, exactly one of `discountPct` or `fixedPriceCents`, `startsAt`, `endsAt`, and an optimistic-lock `version`. A product can have one current campaign. `ProductOfferAudit` records operator, before/after values and date.

The future authenticated admin can call the server-only application service `saveProductOffer(offer, actor)` after verifying the operator role. No public mutation endpoint is exposed. For an initial configuration use `version: 0`; for updates send the version last read. Concurrent edits are rejected. An operational CLI is available:

```
bun scripts/catalog-partners/manage-offer.ts offer.json operator-identity
```

It requires a configured `DATABASE_URL`. Use the `ProductOffer` JSON shape in `data/catalog/product-offers.json`. To turn a funnel OFF, preserve the other values and set `enabled: false`. To activate the 75% preset set `discountPct: 75` and `fixedPriceCents: null`. Fixed prices are integer EUR cents; variant supplements remain the supplier's regular supplements. Percentage discounts apply to each full variant price. Do not combine modes.

Supplier imports seed the initial 10 campaigns once with `skipDuplicates`. Daily refreshes never overwrite operator changes or reset deadlines. Active offers appear at `/offers`, the home featured carousel and the product cards. OFF, future and expired offers are not listed and their funnel routes return 404. `/offers/painel-ripado` remains an alias of the Carvalho campaign, subject to the same ON/OFF and expiry rules.

Catalog service, funnel, cart and payment all use central prices. Saved carts refresh against the server; checkout never accepts a browser price. Campaign references mean supplier catalogue prices, not invented previous store prices. No historical store-low-price record has been created.

During September, accessories receive 70% independently or 75% when ordered with a non-accessory product. This benefit replaces, rather than compounds, discounts. Removing all main products removes the bundle benefit. Suggestions prioritize matching brands, which does not itself certify installation compatibility.

## Reference comparison

`nexflowx-hub/nuraltainteriores` contains 41 product entries: 38 exact matches in the current partner catalogue, two excluded samples, and the standalone Nuralta mock/brand example. Ten exact matches were selected (five ODEM and five WoodUpp); see `data/catalog/product-offers.json`. The existing E-com.casa funnel layout was reused with real product descriptions, dimensions, gallery, variants and prices. No reference repository reviews or fabricated prices were copied.

## Media

The merchant confirmed WoodUpp reuse rights on 2026-09-12. The provider snapshot and scraper publish the supplier's original image URLs. `data/catalog/media-authorizations.json` records this authorization. No replacement/generated product photography was used.
