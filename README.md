# E-com.casa — Make Your Space Yours.

A polished, Vercel-ready **European home & garden e-commerce demo** built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Prisma (PostgreSQL / Neon)**.

> E-com.casa is a trading brand operated by **VANTERA DIGITAL LTD** (Company No. 17422035, 71–75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom).
> This repository contains the V1 **demo** build: a 120-product synthetic "preview catalogue", cart, mock checkout, orders, editorial content, a full legal/compliance architecture and a one-shot market-research import pipeline.

**Demo messaging:** “Preview catalogue — E-com.casa” · “Demo checkout — no payment will be charged.”

---

## ✨ What's inside

### Storefront
- **Editorial homepage** matching the approved visual mockup: announcement bar, mega-nav with search, cinematic hero ("Make Your Space Yours."), Shop by Space, Shop by Style, 4 Transformation Collections, Best Sellers, Journal banner, trust indicators
- **Shop** (`/shop`) — filters for category / space / style / price (+ material, colour, availability via API), 6 sort options, mobile filter sheet, pagination
- **Product pages** (`/product/[slug]`) — gallery, **interactive variants** (colour / size / pack with price deltas), quantity, add-to-cart, buy-now, wishlist, GPSR safety & compliance block, related products, **Complete the Look**, JSON-LD (aggregate rating suppressed for demo reviews)
- **Relational catalogue** — Complete the Look, related products, cart cross-sell computed from category/space/style/collection metadata
- **Cart** (`/cart`) — variant-aware line items, save-for-later, free-shipping progress, promo codes (`WELCOME10`, `HOME5`), gift wrap, delivery notes
- **Demo checkout** (`/checkout`) — 28 EU/UK countries, delivery options, no real payment credentials ever collected; the order endpoint re-prices everything **server-side** (incl. variant deltas from the catalogue model)
- **Order confirmation + order history** — email lookup with status tracker
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

### Demo-flagged data model
Every seeded product carries `isDemo = true`, `complianceStatus = DEMO`, `reviewMode = demo`, `documentationStatus = DEMO`, GPSR scaffold fields (manufacturer/EU-responsible-person **placeholders only** — nothing fabricated), `sourceResearchId` for internal research traceability, and no fake "was" prices. Demo reviews show "Sample product feedback — demonstration only"; no AggregateRating schema is emitted; no Verified Buyer claims.

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
  catalog-research/        # ★ one-shot research pipeline (dev-only)
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
npm run db:seed                 # idempotent — imports the 120-product demo catalogue
npm run dev                     # http://localhost:3000
npm run lint
npm run build
```

Seed integrity checks run automatically: unique SKUs, demo flags, required display fields. Running `db:seed` twice creates no duplicates.

## 🔎 One-shot catalog research (dev-only utility)

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

## ☁️ Deploy to Vercel (Neon PostgreSQL)

1. Push this repository to GitHub
2. Import into Vercel — framework auto-detected (Next.js)
3. Attach the Neon Postgres integration (or set `DATABASE_URL` manually)
4. Add the environment variables from `.env.example` (`NEXT_PUBLIC_SITE_URL`, `COMMERCE_MODE=demo`, `NEXT_PUBLIC_STRIPE_ENABLED=false`, `NEXT_PUBLIC_INDEXING_ENABLED=false`, `NEXT_PUBLIC_CHAT_ENABLED=true`)
5. Run once against Neon: `npx prisma migrate deploy` (or `prisma db push`) then `npm run db:seed`
6. Deploy

No local SQLite, no local filesystem database — the production runtime is PostgreSQL-only. If the database is briefly unreachable, the storefront degrades gracefully to the bundled JSON artifacts via the demo adapter.

## 🔐 Environment variables

See `.env.example`. **Never commit `.env`.** Only `NEXT_PUBLIC_*` values reach the browser.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (https://e-com.casa) |
| `COMMERCE_MODE` | `demo` — mock checkout, no charges |
| `NEXT_PUBLIC_STRIPE_ENABLED` | `false` until Stripe goes live (official Stripe components only) |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | analytics load only after cookie consent |
| `NEXT_PUBLIC_INDEXING_ENABLED` | `false` while the catalogue is synthetic (noindex) |
| `NEXT_PUBLIC_CHAT_ENABLED` | floating Concierge widget |

## 🖥️ Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run db:push` / `db:migrate` / `db:generate` | Prisma schema sync / migrations / client |
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
