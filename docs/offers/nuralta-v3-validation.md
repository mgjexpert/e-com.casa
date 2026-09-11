# Offer V3 preview validation

Reference funnel: https://www.nuraltainteriores.online/

Implementation target: `/offers/painel-ripado`

Validation focus before merge:

- Product-first two-column hero and compact campaign chrome
- Variant swatches, size-option presentation, quantity and panel calculator
- Existing E-com.casa cart / buy-now / checkout integration preserved
- Delivery/trust block directly below purchase actions
- Storytelling, benefits, numbered technical accordions, inspiration gallery
- Ratings/reviews visual layer retained; demo content remains explicitly non-verified and is not emitted as Review/AggregateRating structured data
- Numbered FAQ and compact MGJ EXPERT LTD institutional footer
- Mobile sticky CTA
- No changes to payment provider, checkout state machine, product API or Prisma schema

Production promotion should happen only after preview/build validation and product saleability/compliance review.
