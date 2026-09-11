# Offers production deploy checklist

- Offers lint succeeds.
- Vercel preview production build succeeds.
- `/offers/painel-ripado` returns 200.
- Full storefront navigation is suppressed on the Offer; minimal E-com.casa GEO header remains.
- Institutional footer, cookies, chat and cart drawer remain available.
- Video slots load independently of product images and are labelled as editorial reference where applicable.
- Country is resolved through the existing country engine; manual language preference is preserved.
- Staged catalogue products cannot be charged.
- `/`, `/shop`, `/product/*`, `/cart` and `/checkout` have no regression after merge.
- Production deployment is READY before campaign traffic is sent.
