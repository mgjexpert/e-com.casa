# E-com.casa — Production operations

## 1. XPayments checkout

E-com.casa uses XPayments as the server-side payment provider and the Stripe-compatible Payment/Express Checkout Elements in the browser.

Required Production environment variables:

```text
PAYMENT_ENVIRONMENT=live
XPAYMENTS_STRIPE_BASE_URL=https://api.xpayments.digital/api/stripe/v1
XPAYMENTS_API_KEY=xp_live_...
XPAYMENTS_STORE_ID=ECOM-CASA
NEXT_PUBLIC_XPAYMENTS_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_API_VERSION=                       # only when required by the Store contract
```

`XPAYMENTS_WEBHOOK_SECRET` is optional. When it is absent, `/api/payments/status` retrieves the PaymentIntent server-to-server from XPayments for authenticated pending orders and applies the result idempotently. If a merchant webhook is enabled later, `/api/webhooks/xpayments` remains an optional push path and uses the same reconciliation logic.

A browser can never mark an order paid. Amount and currency are validated against the server-priced order before PAID is persisted. Stock is decremented at most once.

### Live acceptance test

Before traffic is sent to the shop, execute one low-value real checkout and confirm the complete chain:

1. pending order created;
2. XPayments PaymentIntent created;
3. Payment/Express Checkout Element confirms the payment;
4. success page reconciles the PaymentIntent with XPayments;
5. Order = PAID / CONFIRMED;
6. stock is decremented once;
7. tracking is assigned;
8. Resend confirmation email is sent.

Do not interpret the internal `Invoice` table as a legally issued fiscal invoice. Fiscal issuance is a separate adapter/workstream.

## 2. Production catalogue

The historic `catalog-research-v2` dataset is research/demo data. It is not supplier inventory and demo rows cannot create a payable checkout.

The first production supplier adapter is BigBuy because its Ecommerce/Marketplace relationship provides catalogue, stock, order/shipping APIs and supplier media intended for distributor use under the active commercial agreement.

### BigBuy environment

```text
BIGBUY_API_BASE_URL=https://api.bigbuy.eu
BIGBUY_API_KEY=...
BIGBUY_ISO_CODE=en
BIGBUY_TARGET_PRODUCTS=220
BIGBUY_MIN_STOCK=3
BIGBUY_MAX_HANDLING_DAYS=4
BIGBUY_PRICE_MARKUP=1.28
BIGBUY_PRICE_VAT_RATE=0.23
BIGBUY_ASSET_RIGHTS_CONFIRMED=0
BIGBUY_RETIRE_DEMO=1
BIGBUY_TAXONOMY_IDS=
```

`BIGBUY_ASSET_RIGHTS_CONFIRMED=1` must only be enabled while the active distributor agreement grants E-com.casa commercial use of BigBuy-supplied media. Without it, the synchroniser is preview-only and will not publish products.

### Commands

Preview supplier selection without database writes:

```bash
npm run catalog:sync:bigbuy:dry
```

Publish/update the production catalogue after the API key and media rights are valid:

```bash
npm run catalog:sync:bigbuy
```

The synchroniser:

- auto-detects Home/Kitchen/Garden-related first-level taxonomies (or uses `BIGBUY_TAXONOMY_IDS`);
- reads real supplier product information, price, images and stock;
- initially limits publication to simple, NEW, non-electrical / lower-regulatory home & garden SKUs;
- requires a minimum live stock threshold;
- uses real BigBuy CDN product media and marks it `LICENSED` only after the rights flag is confirmed;
- publishes `isDemo=false`, `reviewMode=live`, zero fabricated ratings/reviews/badges;
- keeps compliance as `PENDING_REVIEW` rather than inventing CE/GPSR documentation;
- blocks the old demo catalogue after at least 20 real supplier products have been published.

Stock should subsequently be refreshed frequently from the supplier API. The full automated order-to-supplier and fiscal adapters are separate controls and should only be enabled once the corresponding supplier/fiscal accounts are authorised.
