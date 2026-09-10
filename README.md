# E-com.casa — Make Your Space Yours.

**E-com.casa ecommerce application** — a polished, Vercel-ready **European home & garden store** built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Prisma (PostgreSQL / Neon)**, with **Stripe-compatible payment processing through XPayments**.

> E-com.casa is a trading brand operated by **VANTERA DIGITAL LTD** (Company No. 17422035, 71–75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom).
> The storefront ships a research-derived catalogue, cart, real payment architecture (Stripe Elements + XPayments), orders, editorial content, a full legal/compliance architecture and one-shot catalog import tooling (dev-only).

---

## ✨ What's inside

### Storefront
- **Editorial homepage** matching the approved visual mockup: announcement bar, mega-nav with search, cinematic hero ("Make Your Space Yours."), Shop by Space, Shop by Style, 4 Transformation Collections, Best Sellers, Journal banner, trust indicators
- **Shop** (`/shop`) — filters for category / space / style / price (+ material, colour, availability via API), 6 sort options, mobile filter sheet, pagination
- **Product pages** (`/product/[slug]`) — gallery, **interactive variants** (colour / size / pack with price deltas), quantity, add-to-cart, buy-now, wishlist, GPSR safety & compliance block, related products, **Complete the Look**, JSON-LD (aggregate rating suppressed for demo reviews)
- **Relational catalogue** — Complete the Look, related products, cart cross-sell computed from category/space/style/collection metadata
- **Cart** (`/cart`) — variant-aware line items, save-for-later, free-shipping progress, promo codes (`WELCOME10`, `HOME5`), gift wrap, delivery notes
- **Real checkout** (`/checkout`) — 28 EU/UK countries, delivery options, **Stripe Payment Element + Express Checkout** (Apple Pay / Google Pay / Link / PayPal where supported) backed by the XPayments Stripe-compatible Direct API; totals are repriced **server-side** (incl. variant deltas from the catalogue model) and the amount is charged in the smallest currency unit
- **Payment lifecycle** — PENDING_PAYMENT → PAYMENT_PROCESSING → PAID (only via verified gateway webhook), plus PAYMENT_FAILED / CANCELLED / REFUNDED; fulfilment stays a separate state machine; stock is finalised only after verified payment; idempotent PaymentIntent creation with persisted intent ids
- **Order confirmation + order history** — status pages verify payment server-side; order access requires the per-order random token (no email-only lookups)
- **Wishlist** (`/wishlist`) — persistent, shareable via URL
- **Search** — global product search across name/description/category/style/space/materials
- **Journal + Inspiration** — editorial content linked to the live catalogue
- **Cookie consent** — Accept all / Reject non-essential / Manage preferences (Necessary, Preferences, Analytics, Marketing); nothing optional loads before consent; persistent settings page
- **Live chat** — "E-com.casa Concierge" floating widget with topic routing and email fallback (provider abstraction: DemoChatProvider now, Intercom/Crisp/Zendesk later)
- **Legal system** — 14 documents under `/legal/*` with country-aware hooks (PT Livro de Reclamações, FR médiateur `[MÉDIATEUR À DÉSIGNER]`, DE Impressum, UK Consumer Rights Act notes). The former EU ODR platform is correctly referenced as **discontinued** (20 July 2025)

### Internationalization
- **7 UI languages**: English, Português, Français, Deutsch, Español, Italiano, Nederlands — full dictionaries, language switcher in the header
- **Country engine** (`src/lib/countries.ts`) — data-driven `getCountryConfiguration()` for 27 EU markets + UK: locale, currency, reference VAT, shipping, withdrawal/returns, consumer rights, legal documents, complaints/ADR, cookie rules, product requirements (GPSR/WEEE/battery), EPR placeholders, payment methods. Placeholders are never invented.

### Catalog architecture (migration-ready)
```
src/lib/catalog/
  types.ts            # domain model (CatalogProduct, variants, safety, query)
  service.ts          # the ONLY catalogue entrypoint used by the UI
  prisma-adapter.ts   # PostgreSQL / Neon adapter
  demo-adapter.ts     # JSON-artifact fallback (data/catalog/*.json)
  recommendations.ts  # Complete the Look / related / cross-sell engine
```
The UI never queries Prisma for catalogue reads. To connect the future **real** catalogue, implement a new adapter behind the same facade — no frontend redesign.

### Internal catalogue lifecycle flags
Catalogue rows carry internal lifecycle fields (`isDemo`, `complianceStatus`, `reviewMode`, `documentationStatus`) used **only inside the pipeline** — shoppers never see them. GPSR scaffold fields are **placeholders only** (nothing fabricated), `sourceResearchId` keeps research traceability internal, and there are no fake "was" prices. Only verified customer reviews are ever displayed, and AggregateRating schema is emitted solely from real customer reviews.

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Fonts | Playfair Display (display serif) + Inter (sans) |
| Database | Prisma ORM + **PostgreSQL (Neon)** |
| State | Zustand (persisted cart / wishlist / cookie consent / language) |
| Icons | Lucide |
| Images | next/image + 60+ AI-generated editorial assets (own imagery only — no hotlinked third-party photography) |

---

## 📁 Project structure

```
src/
  app/                     # App Router pages + API routes
    api/                   # products, search, orders, reviews, newsletter, contact, chat
    shop/ product/ cart/ checkout/ wishlist/ search/ account/
    journal/ inspiration/ about/ contact/ sustainability/ shipping/ returns/ legal/
  components/              # layout, home, product, cart, chat, cookie, legal, ui
  lib/
    catalog/               # ★ catalogue service abstraction (see above)
    countries.ts           # ★ country/currency/legal engine (27 EU + UK)
    constants.ts           # commerce config (delegates to countries engine)
    company.ts             # legal identity + email aliases
    legal-content.ts       # 14 legal documents dataset
    i18n.ts                # 7-language UI dictionaries
    db.ts                  # Prisma client
  types/                   # shared types (Product = CatalogProduct)
data/catalog/              # reproducibility artifacts from the research run
  generated-products.json  # the 120-product demo catalogue (seed input)
  generated-catalog.json   # categories/spaces/styles/collections metadata
  generated-relations.json # relational merchandising documentation
  generated-bundles.json   # 6 demo bundles
prisma/
  schema.prisma            # PostgreSQL + research layer models
  seed.ts                  # ★ idempotent seed (safe to re-run)
scripts/
  catalog-research/        # legacy V1 research pipeline (dev-only)
  catalog-research-v2/     # ★ CATALOG SCRAPER V2 — deep product extraction engine (dev-only)
  generate-catalog-images.sh
reports/
  catalog-research-report.json / .md
```

---

## 🚀 Local development

```bash
npm install                     # or bun install
cp .env.example .env            # then set DATABASE_URL (Neon or local Postgres)
npx prisma generate
npx prisma db push             # (or create/apply migrations for production)
npm run db:seed                 # idempotent — imports the demo catalogue fixtures (fallback)
npm run dev                     # http://localhost:3000
npm run lint
npm run build
```

Seed integrity checks run automatically: unique SKUs, demo flags, required display fields. Running `db:seed` twice creates no duplicates.

## 🔎 One-shot catalog research (dev-only utility)

```bash
### CATALOG SCRAPER V2 (primary — deep product extraction)

```bash
npm run catalog:scrape-v2                              # full run: discover → extract → select → import
npm run catalog:scrape-v2 -- --dry-run                 # no Product writes
npm run catalog:scrape-v2 -- --source=viridian-bay     # single source
npm run catalog:scrape-v2 -- --limit=60                # cap final selection
npm run catalog:scrape-v2 -- --phase=crawl             # discovery+extraction only (resume later)
npm run catalog:scrape-v2 -- --resume=<runId>[,<run2>] # rebuild/selection/import from persisted research
```

```bash
# Populate Neon from the committed replay artifact (no crawling):
DATABASE_URL="<neon-pooled>" bun scripts/catalog-research-v2/replay-import.ts
# Regenerate the artifact from the current database:
DATABASE_URL="<local>" bun scripts/catalog-research-v2/export-catalogue.ts
# Post-import QA helpers:
DATABASE_URL="<db>" bun scripts/catalog-research-v2/reclassify.ts       # evidence-weighted category pass
DATABASE_URL="<db>" bun scripts/catalog-research-v2/retire-legacy.ts    # retire non-research-backed products (§82)
DATABASE_URL="<db>" bun scripts/catalog-research-v2/final-report.ts     # regenerate honest reports
```

V2 extracts REAL public product pages (JSON-LD → microdata → embedded JSON → OG/meta → DOM), full galleries, variants, specs with per-field evidence; scores completeness/quality; dedupes across sources; and imports idempotently with stable `EC-<CAT>-###` SKUs. Sources that block the research client are recorded as BLOCKED — never circumvented. See `reports/catalog-scrape-v2-report.md` for the actual run.

### Legacy V1 pipeline (fallback reference)

```bash
npm run catalog:research                     # full run + import
npm run catalog:research -- --dry-run        # crawl/normalize/score, no DB writes
npm run catalog:research -- --source=kave-home
npm run catalog:research -- --limit=50
```

**What it is:** a one-time market/product research importer that discovers candidate products across 12 public retail references (Kave Home, Maisons du Monde, Lampenwelt, The Wall Panel Centre, Ferm Living, Nordic Nest, MoroDeco, Luxent, Lewpe, The Cozy Garden, Viridian Bay, Govee EU), normalizes/dedupes/scores them (100-point system), and generates the original E-com.casa demo catalogue into `data/catalog/*.json` + PostgreSQL + a full report (`reports/catalog-research-report.md`).

**What it is NOT:** not a production crawler. There is **no** `/api/scrape`, no cron job, no background crawler, no live competitor sync. It runs manually in development only.

**Ground rules honored by the pipeline:**
- Publicly available pages only; robots.txt respected; fixed non-browser user agent; throttled (1.5 s default) with bounded pages per source
- A blocked source is recorded and skipped — **no circumvention** of anti-bot protections
- No logins, no private APIs, no personal/customer/payment data, no checkout scraping
- Nothing third-party is published: source names/URLs/prices/images stay internal research metadata; public copy, names and imagery are original E-com.casa; no third-party reviews or ratings
- Research data ≠ production product: nothing is auto-promoted; real products later require supplier + compliance review

### From research → production catalogue (future path)
```
research product → supplier identified → supplier product → real cost
→ real manufacturer → compliance review → real product → production
```
Each demo product keeps `sourceResearchId/sourceDomain/sourceUrl` internally so future sourcing teams can trace concepts back to their market references.

---

## 💳 Payments — architecture (XPayments + Stripe Elements)

```
Browser → Stripe.js / Stripe Elements (Payment Element + Express Checkout)
        → client_secret
        → E-com.casa Next.js server (route handlers only)
        → XPayments Stripe-compatible API  (POST {base}/payment_intents)
        → configured gateway
        → XPayments merchant webhook  (POST /api/webhooks/xpayments)
        → order state (PAID only after verified event)
        → invoice workflow → fulfilment → customer email
```

- **Server routes:** `POST /api/checkout/create` (server-repriced PENDING order + access token), `POST /api/payments/create-intent` (idempotent intent creation via XPayments), `GET /api/payments/status`, `GET /api/payments/capabilities`, `POST /api/webhooks/xpayments`
- **Provider abstraction:** `src/lib/payments/payment-provider.ts` with the single production implementation `xpayments-provider.ts` — `application/x-www-form-urlencoded`, `Authorization: Bearer xp_*`, `Idempotency-Key` (`ecom-order-<num>-<hash>`) and `Stripe-Version` preserved on every request
- **State machines:** payment (`PENDING_PAYMENT → PAYMENT_PROCESSING → PAID | PAYMENT_FAILED | CANCELLED | REFUNDED`) is strictly separate from fulfilment (`CONFIRMED → …`); webhook transitions are monotonic (a stale event can never un-PAID an order) and idempotent via persisted event ids (`WebhookEvent`)
- **Money:** amounts are converted to the smallest currency unit with an exponent table; floating-point amounts never reach the gateway
- **Security:** the browser only ever receives the publishable key and `client_secret`; webhook verification is fail-closed (timing-safe HMAC); no card data touches E-com.casa systems; rate limiting on checkout/payment/webhook/form routes; safe logging only (order number, intent id, event id, status)
- **Payment models (Prisma):** `Payment`, `PaymentAttempt`, `Refund`, `Invoice`, `CreditNote`, `WebhookEvent` + payment fields on `Order` (`paymentStatus`, `paymentIntentId`, `accessToken`, `paidAt`, …)

### Payment methods availability
Availability is layered: storefront configuration (`PAYMENT_METHODS`) → country/currency rules → gateway capability. Supplied brand assets live in `public/payment-methods/` and are shown only where the rules allow; a logo never implies gateway availability.

| Method | Markets | Notes |
|---|---|---|
| Card (Visa · Mastercard · Amex) | all | via Payment Element |
| MB WAY | PT · EUR | requires merchant activation at XPayments |
| Multibanco | PT · EUR | async — success page polls server-verified state |
| Bizum | ES · EUR | requires merchant activation |
| BLIK | PL | requires merchant activation |
| Bancontact | BE · EUR | requires merchant activation |
| Apple Pay / Google Pay / Link / PayPal | dynamic | official buttons via Express Checkout Element (browser/device/merchant-dependent) |
| PIX | BR · BRL only | configuration-gated (`PAYMENT_METHODS`); never shown in Europe |

### Webhook setup (merchant configuration required)
1. Point the XPayments merchant webhook to `https://<your-domain>/api/webhooks/xpayments`
2. Set `XPAYMENTS_WEBHOOK_SECRET` to the signing secret from the merchant account
3. The handler is fail-closed: deliveries without a valid timing-safe HMAC signature are rejected (400)

### Apple Pay / Google Pay domain setup (merchant configuration required)
Register the production domain for Apple Pay / Google Pay in the payment dashboard (Apple Pay domain verification file or dashboard setting, depending on the XPayments store configuration). The Express Checkout Element renders wallet buttons only for properly registered domains and capable browsers.

### Test / live mode
`PAYMENT_ENVIRONMENT=test` uses `xp_test_*` / `pk_test_*` credentials — the storefront UI stays normal (there is no customer-facing "test" messaging). Switch to `live` with `xp_live_*` / `pk_live_*`; never mix environments.

## ☁️ Deploy to Vercel (Neon PostgreSQL)

1. Push this repository to GitHub
2. Import into Vercel — framework auto-detected (Next.js)
3. Attach the Neon Postgres integration (or set `DATABASE_URL` manually — use the **pooled** endpoint)
4. Add the environment variables from `.env.example` — payments require `XPAYMENTS_SECRET_KEY`, `XPAYMENTS_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `PAYMENT_ENVIRONMENT` at minimum
5. Apply the schema once against Neon: `npx prisma migrate deploy`, then seed the catalogue: `npm run db:seed`
6. Deploy

No local SQLite, no local filesystem database — the production runtime is PostgreSQL-only. If the database is briefly unreachable, the storefront degrades gracefully to the bundled JSON artifacts via the fallback adapter.

## 🔐 Environment variables

See `.env.example`. **Never commit `.env`.** Only `NEXT_PUBLIC_*` values reach the browser — the `xp_*` server keys never do.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled endpoint) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (https://e-com.casa) |
| `PAYMENT_ENVIRONMENT` | `test` or `live` |
| `XPAYMENTS_API_BASE_URL` | XPayments Stripe-compatible base URL |
| `XPAYMENTS_SECRET_KEY` | **server-only** `xp_test_*` / `xp_live_*` credential |
| `XPAYMENTS_WEBHOOK_SECRET` | merchant webhook signing secret |
| `XPAYMENTS_STORE_ID` | optional store identifier (metadata) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | publishable `pk_*` key (browser) |
| `STRIPE_API_VERSION` | Stripe-Version header preserved on XPayments requests |
| `PAYMENT_METHODS` | storefront-active methods (PIX opt-in) |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | analytics load only after cookie consent |
| `NEXT_PUBLIC_INDEXING_ENABLED` | keep `false` until the real store goes live (noindex) |
| `NEXT_PUBLIC_CHAT_ENABLED` | floating Concierge widget |

## 🖥️ Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run db:push` / `db:migrate` / `db:generate` | Prisma schema sync / migrations / client |
| `npx prisma migrate deploy` | apply committed migrations to Neon (production-safe, additive) |
| `npm run db:seed` | idempotent demo-catalogue seed (from `data/catalog/*.json`) |
| `npm run catalog:research` | one-shot market research + catalogue generation (dev only) |

## 🧭 Legal & compliance notes

- **Identity:** E-com.casa is presented as the storefront brand operated by VANTERA DIGITAL LTD (the two are never presented as different sellers).
- **No invented compliance:** VAT numbers, phone numbers, EPR/WEEE registrations, mediators, ADR entities, return warehouses and certifications are `[TO BE CONFIRMED]` placeholders until real documents exist.
- **EU/UK consumer baseline:** 14-day withdrawal, 2-year legal guarantee (EU), clear pre-contract information; country configs can extend (never reduce) mandatory rights.
- **GPSR:** product safety data model exists (manufacturer, EU responsible person, warnings, product identifier); demo products are `DEMO` and require compliance review before any production listing.
- **ODR:** the old EU ODR platform is explicitly described as discontinued — no dead links.
- **Indexing:** `NEXT_PUBLIC_INDEXING_ENABLED=false` sets `noindex` while the catalogue is synthetic; flip to `true` for production.

## 🗺️ Roadmap (prepared, not yet active)
- Stripe (official SDK + payment elements) behind `NEXT_PUBLIC_STRIPE_ENABLED`
- Real chat provider (Intercom / Crisp / Zendesk) behind the ChatProvider abstraction
- Analytics providers (GA / Meta / TikTok / Pinterest / Merchant) behind consent-gated loading
- Admin surfaces (`/admin/*` routes are intentionally NOT exposed in V1)
- Locale-routed editorial & legal content (`/pt/...`, `/de/...` etc.) — dictionaries are already in place
