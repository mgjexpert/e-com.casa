# BigBuy authenticated web research

This flow is for the E-com.casa supplier-research layer when a BigBuy account can view wholesale catalogue data but no BigBuy API key is available.

## Scope

The crawler is intentionally limited to these roots:

- `https://www.bigbuy.eu/pt/shop/category/casa-e-cozinha`
- `https://www.bigbuy.eu/pt/shop/category/iluminacao`

It authenticates with the account supplied through private environment secrets, discovers product pages through the rendered category DOM, parses JSON-LD/semantic HTML/visible authenticated price candidates, and writes the result to the Prisma `Research*` tables.

It **does not** write to `Product`, does not make products saleable, and does not publish BigBuy images or wholesale prices to the public site. This keeps supplier research separate from commercial approval, media-rights approval, GPSR/electrical review, retail pricing and stock validation.

## Required GitHub Actions secrets

Configure these in **GitHub → repository Settings → Secrets and variables → Actions**:

- `DATABASE_URL` — production/staging PostgreSQL connection used by E-com.casa.
- `BIGBUY_EMAIL` — authorised BigBuy account email.
- `BIGBUY_PASSWORD` — authorised BigBuy account password.

Do not put any of these values in source files, issues, commits, workflow inputs, or chat messages.

The workflow is `.github/workflows/catalog-bigbuy-web.yml`. It also runs when the scraper/workflow itself changes. If the first run fails because secrets are missing, configure the secrets and re-run the failed job.

## Safety/behaviour

The crawler checks `robots.txt` before category crawling and stops when the relevant target path is disallowed. It also stops on CAPTCHA/anti-bot challenges instead of attempting a bypass. Login cookies exist only in the ephemeral browser context on the CI runner and are not persisted.

Wholesale prices are stored only in the database. CI logs contain counts/status but not credentials, cookies, or wholesale price values.

The research script creates only missing isolated `Research*` tables required by the job because the production database historically did not have a complete catalogue migration baseline. It does not alter storefront, order or payment tables.

## Data captured

Per product the scraper attempts to capture BigBuy product ID from the canonical URL, canonical URL, name, brand, description, category/breadcrumb path, SKU, EAN/GTIN/MPN where visible, authenticated wholesale price candidate with confidence metadata, availability text, exact numeric stock only when explicitly stated, attributes/specifications, material, colours, dimensions, weight, image source URLs, option/variant groups, extraction confidence and completeness score.

A missing field remains `null`; the crawler does not infer wholesale price, stock quantity, EAN, compliance, certification, or manufacturer information.

## Promotion to the public catalogue

Research results are not automatically promoted. A later approval step should require, at minimum, supplier/media-use rights, reliable supplier identity/SKU, usable retail pricing, availability, appropriate GPSR documentation, and additional electrical/WEEE/CE review for lighting products. Only after that should selected records be normalised into the public `Product`/future Catalog V2 tables.
