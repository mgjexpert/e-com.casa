# E-com.casa — Make Your Space Yours.

A production-ready, full-stack European **home & garden e-commerce** experience built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Prisma (SQLite)**.

> E-com.casa is a trading brand operated by **VANTERA DIGITAL LTD** (Company No. 17422035, London, UK).
> This repository contains the V1 mock/demo build: catalogue, cart, checkout, orders, editorial content and a full legal/compliance scaffold.

---

## ✨ Features

### Storefront
- **Editorial homepage** matching the approved visual mockup 1:1: announcement bar, mega-nav with search, cinematic hero, Shop by Space (7), Shop by Style (7 circular), 4 Transformation Collections, Best Sellers, Journal banner with brand pillars
- **Shop** (`/shop`) with category / space / style / price filters, 6 sort options, mobile filter sheet, empty + loading states
- **Product pages** (`/product/[slug]`) with gallery, ratings, quantity, add-to-cart, buy-now, wishlist, details, delivery/returns, **GPSR Safety & Compliance block**, related products, Product JSON-LD
- **Cart** (`/cart`) — quantity management, save-for-later, free-shipping progress bar, promo codes (`WELCOME10`, `HOME5`), "Complete the look" cross-sell
- **Checkout** (`/checkout`) — contact, address (14 EU/UK countries), delivery options (standard/express, free over €50), payment method selection, marketing opt-in (unticked by default), terms acceptance. **Stripe-ready: no card data is ever collected** — the demo order endpoint re-prices everything server-side
- **Order confirmation** (`/checkout/success?order=EC-XXXXXX`) with full order recap
- **Order history** (`/account/orders`) — email-based lookup with status tracker (Confirmed → Processing → Shipped → Delivered)
- **Wishlist** (`/wishlist`) — persistent guest wishlist (localStorage)
- **Search** (`/search?q=`) — global product search with popular suggestions
- **Journal** (`/journal`) + 4 full articles (`/journal/[slug]`) with related products
- **Inspiration** gallery, **About**, **Sustainability**, **Shipping**, **Returns**, **Contact** (working form + FAQ)
- **Cookie consent** — real consent architecture: banner, per-category preferences (Necessary/Preferences/Analytics/Marketing), persistent settings page, footer reopen link. No analytics load before consent
- **Live chat widget** — "E-com.casa Concierge" with topic routing and email fallback (provider-agnostic, Intercom/Crisp/Zendesk-ready)
- **Legal system** — 14 documents under `/legal/*` (notice, terms, privacy, cookies, cookie-settings, returns, shipping, warranty, product-safety, accessibility, complaints, dispute-resolution, impressum, consumer-rights) with central content module and country rule-engine hooks (PT Livro de Reclamações, FR médiateur placeholder)

### Architecture
- `src/lib/constants.ts` — central VAT/country configuration, shipping rules, promo codes, `getCountryRequirements()` rule engine
- `src/lib/company.ts` — single source of truth for legal identity & email aliases
- `src/lib/legal-content.ts` — structured legal document dataset
- Server-side re-pricing on order creation (never trusts client totals)
- Compliance states per product (`PENDING_REVIEW | APPROVED | BLOCKED`); blocked products are never served
- `[TO BE COMPLETED]` placeholder system — no fabricated VAT numbers, phone numbers, addresses or certifications

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Fonts | Playfair Display (display serif) + Inter (sans) |
| Database | Prisma ORM + SQLite |
| State | Zustand (persisted cart/wishlist/cookie consent) |
| Icons | Lucide |
| Images | next/image + 45 AI-generated editorial assets |

## 📁 Project structure

```
src/
  app/                    # App Router pages + API routes
    api/                  # products, search, orders, newsletter, contact
    shop/ product/ cart/ checkout/ wishlist/ search/ account/
    journal/ inspiration/ about/ contact/ sustainability/
    shipping/ returns/ legal/
  components/
    layout/               # header, footer
    home/                 # hero, shop-by-space, shop-by-style, collections, best-sellers, journal-banner
    product/              # product-card, buy-box, shop-client
    cookie/ chat/ legal/  # consent banner, concierge widget, settings panel
    ui/                   # shadcn/ui primitives
  lib/                    # db, stores, constants, company, legal-content, journal-data, format
  types/                  # shared TypeScript types
prisma/                   # schema + seed (18 products, 21 categories)
public/images/            # 45 generated editorial images
scripts/generate-images.ts# batch asset generator (z-ai-web-dev-sdk)
```

## 🚀 Local development

```bash
npm install            # or bun install
cp .env.example .env   # then adjust values
npx prisma db push     # create SQLite database
npx prisma/seed.ts     # seed demo catalogue (bun prisma/seed.ts)
npm run dev            # http://localhost:3000
npm run lint
npm run build
```

## 🔐 Environment variables

See `.env.example`. Only `NEXT_PUBLIC_*` values are exposed to the browser. **Never commit `.env`.**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite connection (`file:./db/custom.db`) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (https://e-com.casa) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` | Future Stripe integration |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Analytics (load only after consent) |
| `NEXT_PUBLIC_CHAT_PROVIDER` | Chat provider switch |

## ☁️ Deploy to Vercel

1. Push this repo to GitHub
2. Import into Vercel — framework auto-detected (Next.js)
3. Add env vars from `.env.example`
4. Deploy. For production traffic swap SQLite → Postgres (Prisma makes this a one-line change)

## 💳 Future Stripe integration

`POST /api/orders` is the seam: replace the mock `paymentStatus: 'PAID'` with a Stripe PaymentIntent creation, keep the server-side re-pricing, and render Stripe's hosted Payment Element at `/checkout`. No frontend card collection exists today by design (PCI scope).

## 🌍 Localization

Locale architecture (EN/PT/FR/DE/ES/IT/NL) is prepared via the language selector, `getCountryRequirements()` and per-country legal overrides. Route-level i18n (`/pt/...`) is the next step — translation dictionaries are centralised in `src/lib/`.

## ⚖️ Legal placeholders — require human verification before live sales

- [ ] VAT number(s) + OSS registration status
- [ ] Telephone number (intentionally shown as "To be provided")
- [ ] Manufacturer / EU responsible person per real product (GPSR)
- [ ] CE / WEEE / battery documentation for electrical SKUs
- [ ] Returns warehouse address
- [ ] French consumer mediator (`[MÉDIATEUR DE LA CONSOMMATION À DÉSIGNER]`)
- [ ] Hosting provider disclosure (Legal Notice / Impressum)
- [ ] Final legal review (Terms, Privacy, Cookies) by qualified counsel
- [ ] PT Livro de Reclamações applicability confirmation
- [ ] Demo reviews/stock are illustrative only

## 📄 License

Proprietary — © 2026 E-com.casa / VANTERA DIGITAL LTD. All rights reserved.
