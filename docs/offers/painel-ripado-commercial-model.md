# Painel Ripado — catalogue + offer commercial model

## Public routes

- `/product/warm-oak-slatted-wall-panel` — normal catalogue product.
- `/offers/painel-ripado` — dedicated promotional funnel, ported from the Z.AI visual sandbox.
- `/offers` — active promotional offers index.

## Pricing

The catalogue is the regular-price channel:

- 240 × 60 cm: €20.00
- 260 × 70 cm: €36.00
- 270 × 80 cm: €52.00
- 270 × 110 cm: unavailable

The `PAINEL75` campaign applies a server-validated 75% discount only to `warm-oak-slatted-wall-panel`, producing offer prices:

- 240 × 60 cm: €5.00
- 260 × 70 cm: €9.00
- 270 × 80 cm: €13.00

Client-provided prices are never trusted. `/api/checkout/create` continues to call `repriceCart()`, which reads the regular catalogue price and applies the eligible promotion server-side.

## Visual source

`nexflowx-hub/nuraltainteriores` remains the design sandbox. The production offer reuses its campaign composition and public media while commerce state, catalogue, company identity, checkout and payments remain inside E-com.casa.

The campaign review presentation is intentionally not emitted as `Review` or `AggregateRating` structured data. This keeps marketing presentation separate from factual SEO markup until a verified review source is connected.
