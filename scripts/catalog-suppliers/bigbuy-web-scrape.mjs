#!/usr/bin/env node
/**
 * E-com.casa — authenticated BigBuy website catalogue research
 *
 * Scope is deliberately limited to research/staging tables. This script never
 * promotes a scraped product to the public Product table and never makes a
 * product saleable. Wholesale prices are written only to the private database;
 * they are not committed to this public repository or printed to CI logs.
 *
 * Required environment variables:
 *   DATABASE_URL
 *   BIGBUY_EMAIL
 *   BIGBUY_PASSWORD
 *
 * Optional:
 *   BIGBUY_MAX_PRODUCTS_PER_ROOT=100
 *   BIGBUY_MAX_CATEGORY_PAGES=30
 *   BIGBUY_REQUEST_DELAY_MS=900
 *   BIGBUY_HEADLESS=1
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const db = new PrismaClient();

const BASE = 'https://www.bigbuy.eu';
const ROOTS = [
  {
    key: 'casa-e-cozinha',
    name: 'Casa e cozinha',
    url: `${BASE}/pt/shop/category/casa-e-cozinha`,
  },
  {
    key: 'iluminacao',
    name: 'Iluminação',
    url: `${BASE}/pt/shop/category/iluminacao`,
  },
];

const EMAIL = (process.env.BIGBUY_EMAIL || '').trim();
const PASSWORD = process.env.BIGBUY_PASSWORD || '';
const MAX_PRODUCTS_PER_ROOT = clampInt(process.env.BIGBUY_MAX_PRODUCTS_PER_ROOT, 100, 1, 500);
const MAX_CATEGORY_PAGES = clampInt(process.env.BIGBUY_MAX_CATEGORY_PAGES, 30, 1, 100);
const REQUEST_DELAY_MS = clampInt(process.env.BIGBUY_REQUEST_DELAY_MS, 900, 400, 10_000);
const HEADLESS = !/^(0|false|no)$/i.test(process.env.BIGBUY_HEADLESS || '1');
const USER_AGENT = 'E-com.casa-CatalogResearch/1.0 (+https://www.e-com.casa)';

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw || '', 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
  return cleanText(String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' '));
}

function boundedJson(value, max = 24_000) {
  const text = JSON.stringify(value);
  if (text.length <= max) return text;
  return JSON.stringify({ truncated: true, preview: text.slice(0, max - 100) });
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function productIdFromUrl(url) {
  const match = String(url).match(/_(\d+)(?:[/?#]|$)/);
  return match?.[1] || null;
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url, BASE);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return String(url || '');
  }
}

function parseMoney(text) {
  const value = cleanText(text);
  const matches = [...value.matchAll(/(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)(?:\s*€)?/g)];
  for (const match of matches) {
    const raw = match[1];
    if (!raw) continue;
    let normalized = raw.replace(/\s/g, '');
    if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replace(/\./g, '').replace(',', '.');
    else if (normalized.includes(',')) normalized = normalized.replace(',', '.');
    const amount = Number.parseFloat(normalized);
    if (Number.isFinite(amount) && amount > 0 && amount < 1_000_000) return amount;
  }
  return null;
}

function pickWholesalePrice(candidates, authenticated) {
  const rows = (candidates || [])
    .map((candidate) => ({
      ...candidate,
      text: cleanText(candidate.text),
      context: cleanText(candidate.context),
      amount: parseMoney(candidate.dataPrice || candidate.text || candidate.context),
    }))
    .filter((candidate) => candidate.amount != null);

  const wholesaleLabel = /(grossista|atacado|wholesale|mayorista|pre[cç]o\s+(?:de\s+)?compra|tu\s+precio|your\s+price)/i;
  const retailLabel = /(pvpr|rrp|recommended|recomendad|retail|pre[cç]o\s+recomendado)/i;

  const labelled = rows.find((row) => wholesaleLabel.test(`${row.text} ${row.context}`));
  if (labelled) return { amount: labelled.amount, confidence: 'HIGH', reason: 'WHOLESALE_LABEL' };

  if (authenticated) {
    const primary = rows.find((row) =>
      !retailLabel.test(`${row.text} ${row.context}`) &&
      /(product[-_ ]?price|final[-_ ]?price|special[-_ ]?price|price[-_ ]?wrapper|itemprop)/i.test(row.selector || ''),
    );
    if (primary) return { amount: primary.amount, confidence: 'MEDIUM', reason: 'AUTHENTICATED_PRIMARY_PRICE' };
  }

  return { amount: null, confidence: 'NONE', reason: authenticated ? 'AMBIGUOUS_AUTHENTICATED_PRICE' : 'AUTH_REQUIRED' };
}

function deriveAttribute(attributes, patterns) {
  for (const [key, value] of Object.entries(attributes || {})) {
    if (patterns.some((pattern) => pattern.test(key))) return cleanText(value);
  }
  return null;
}

function deriveCompleteness(record) {
  const checks = [
    record.name,
    record.sourceProductId,
    record.canonicalUrl,
    record.description,
    record.brand,
    record.images?.length,
    record.attributes && Object.keys(record.attributes).length,
    record.sku || record.ean || record.gtin,
    record.wholesalePrice,
    record.availabilityText,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function robotsAllows(robotsText, targetPath) {
  const lines = String(robotsText || '').split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim());
  let applies = false;
  const rules = [];
  for (const line of lines) {
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      applies = value === '*' || value.toLowerCase().includes('e-com.casa-catalogresearch');
      continue;
    }
    if (applies && (key === 'allow' || key === 'disallow')) rules.push({ type: key, path: value });
  }

  const matches = rules
    .filter((rule) => rule.path && targetPath.startsWith(rule.path.replace(/\*.*$/, '')))
    .sort((a, b) => b.path.length - a.path.length);
  if (!matches.length) return true;
  return matches[0].type === 'allow';
}

async function assertRobotsAllowsTargets() {
  const response = await fetch(`${BASE}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not verify BigBuy robots.txt (${response.status}). Refusing to crawl.`);
  const text = await response.text();
  for (const root of ROOTS) {
    const path = new URL(root.url).pathname;
    if (!robotsAllows(text, path)) throw new Error(`robots.txt disallows automated access to ${path}. Refusing to crawl.`);
  }
}

async function ensureResearchTables() {
  // Production historically had an incomplete catalogue migration history.
  // Create only the isolated research tables needed by this job. No storefront,
  // order or payment table is altered here.
  const statements = [
    `CREATE TABLE IF NOT EXISTS "ResearchSource" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "homepage" TEXT NOT NULL,
      "tier" INTEGER NOT NULL DEFAULT 2,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "priority" INTEGER NOT NULL DEFAULT 50,
      "lastRunAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchRun" (
      "id" TEXT PRIMARY KEY,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'RUNNING',
      "mode" TEXT NOT NULL DEFAULT 'import',
      "engine" TEXT NOT NULL DEFAULT 'v2',
      "sourceCount" INTEGER NOT NULL DEFAULT 0,
      "sourcesAttempted" INTEGER NOT NULL DEFAULT 0,
      "sourcesSuccessful" INTEGER NOT NULL DEFAULT 0,
      "pagesVisited" INTEGER NOT NULL DEFAULT 0,
      "productPagesVisited" INTEGER NOT NULL DEFAULT 0,
      "productsDiscovered" INTEGER NOT NULL DEFAULT 0,
      "productsParsed" INTEGER NOT NULL DEFAULT 0,
      "productsNormalized" INTEGER NOT NULL DEFAULT 0,
      "productsRejected" INTEGER NOT NULL DEFAULT 0,
      "productsImported" INTEGER NOT NULL DEFAULT 0,
      "errorsJson" TEXT NOT NULL DEFAULT '[]',
      "configJson" TEXT,
      "notes" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchProduct" (
      "id" TEXT PRIMARY KEY,
      "researchRunId" TEXT NOT NULL,
      "sourceId" TEXT,
      "pageId" TEXT,
      "sourceUrl" TEXT NOT NULL,
      "canonicalUrl" TEXT,
      "sourceProductId" TEXT,
      "sourceProductName" TEXT NOT NULL,
      "sourceBrand" TEXT,
      "sourceCategory" TEXT,
      "sourceSubcategory" TEXT,
      "sourceCollection" TEXT,
      "sourcePrice" TEXT,
      "sourceCurrency" TEXT,
      "sourceSalePrice" TEXT,
      "rawPriceText" TEXT,
      "observedAt" TIMESTAMP(3),
      "sourceAvailability" TEXT,
      "sourceSku" TEXT,
      "sourceMpn" TEXT,
      "sourceEan" TEXT,
      "sourceGtin" TEXT,
      "sourceDescription" TEXT,
      "sourceMaterials" TEXT,
      "sourceColours" TEXT,
      "sourceDimensions" TEXT,
      "sourceWeight" TEXT,
      "sourceAttributes" TEXT,
      "sourceImageUrls" TEXT,
      "sourceDataJson" TEXT,
      "productFingerprint" TEXT,
      "researchScore" INTEGER,
      "scoreBreakdownJson" TEXT,
      "extractionMethod" TEXT,
      "extractionConfidence" INTEGER,
      "completenessScore" INTEGER,
      "qualityScore" INTEGER,
      "imageCount" INTEGER NOT NULL DEFAULT 0,
      "variantCount" INTEGER NOT NULL DEFAULT 0,
      "duplicateGroupId" TEXT,
      "duplicateConfidence" DOUBLE PRECISION,
      "duplicateKind" TEXT,
      "selectionRank" INTEGER,
      "generatedSku" TEXT,
      "countryFitJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchPage" (
      "id" TEXT PRIMARY KEY,
      "researchRunId" TEXT NOT NULL,
      "sourceKey" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "canonicalUrl" TEXT,
      "pageType" TEXT NOT NULL DEFAULT 'OTHER',
      "httpStatus" INTEGER,
      "contentType" TEXT,
      "title" TEXT,
      "contentHash" TEXT,
      "bytes" INTEGER,
      "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "errorJson" TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ResearchPage_researchRunId_url_key" ON "ResearchPage"("researchRunId", "url")`,
    `CREATE TABLE IF NOT EXISTS "ResearchVariant" (
      "id" TEXT PRIMARY KEY,
      "researchProductId" TEXT NOT NULL,
      "sourceVariantId" TEXT,
      "name" TEXT NOT NULL,
      "optionsJson" TEXT,
      "sku" TEXT,
      "price" TEXT,
      "currency" TEXT,
      "availability" TEXT,
      "attributesJson" TEXT,
      "imageUrlsJson" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchImage" (
      "id" TEXT PRIMARY KEY,
      "researchProductId" TEXT,
      "sourceKey" TEXT NOT NULL,
      "sourceUrl" TEXT NOT NULL,
      "normalizedUrl" TEXT,
      "position" INTEGER NOT NULL DEFAULT 0,
      "type" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
      "mimeType" TEXT,
      "width" INTEGER,
      "height" INTEGER,
      "fileSize" INTEGER,
      "sha256" TEXT,
      "localPath" TEXT,
      "downloadedAt" TIMESTAMP(3),
      "errorJson" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchAttribute" (
      "id" TEXT PRIMARY KEY,
      "researchProductId" TEXT NOT NULL,
      "fieldKey" TEXT NOT NULL,
      "sourceValue" TEXT NOT NULL,
      "normalizedKey" TEXT,
      "normalizedValue" TEXT,
      "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchEvidence" (
      "id" TEXT PRIMARY KEY,
      "researchProductId" TEXT NOT NULL,
      "field" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "sourceUrl" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "selector" TEXT,
      "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchError" (
      "id" TEXT PRIMARY KEY,
      "researchRunId" TEXT NOT NULL,
      "sourceKey" TEXT,
      "url" TEXT,
      "stage" TEXT NOT NULL,
      "errorType" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_researchRunId_idx" ON "ResearchProduct"("researchRunId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_status_idx" ON "ResearchProduct"("status")`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_productFingerprint_idx" ON "ResearchProduct"("productFingerprint")`,
    `CREATE INDEX IF NOT EXISTS "ResearchVariant_researchProductId_idx" ON "ResearchVariant"("researchProductId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchImage_researchProductId_idx" ON "ResearchImage"("researchProductId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchAttribute_researchProductId_idx" ON "ResearchAttribute"("researchProductId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchEvidence_researchProductId_idx" ON "ResearchEvidence"("researchProductId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchError_researchRunId_idx" ON "ResearchError"("researchRunId")`,
  ];
  for (const statement of statements) await db.$executeRawUnsafe(statement);
}

async function dismissConsent(page) {
  const labels = [/Aceitar todos/i, /Aceitar/i, /Accept all/i, /Aceptar todo/i, /Concordo/i];
  for (const label of labels) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible({ timeout: 400 }).catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => {});
      return;
    }
  }
}

async function detectBotChallenge(page) {
  const body = cleanText(await page.locator('body').innerText({ timeout: 5_000 }).catch(() => ''));
  if (/(captcha|recaptcha|hcaptcha|verify you are human|verifique que é humano|cloudflare challenge)/i.test(body)) {
    throw new Error('BigBuy presented a CAPTCHA/anti-bot challenge. The job will not attempt to bypass it.');
  }
}

async function authenticate(page) {
  const loginCandidates = [`${BASE}/pt/login/`, `${BASE}/es/login/`, `${BASE}/pt/login`];
  let loaded = false;
  for (const url of loginCandidates) {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null);
    if (response && response.status() < 400) {
      loaded = true;
      break;
    }
  }
  if (!loaded) throw new Error('Could not load the BigBuy login page.');
  await dismissConsent(page);
  await detectBotChallenge(page);

  const emailInput = page.locator('input[type="email"], input[name*="email" i], input[autocomplete="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name*="password" i], input[autocomplete="current-password"]').first();
  if (!(await emailInput.isVisible({ timeout: 5_000 }).catch(() => false))) throw new Error('BigBuy login email field was not found.');
  if (!(await passwordInput.isVisible({ timeout: 5_000 }).catch(() => false))) throw new Error('BigBuy login password field was not found.');

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);

  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if (await submit.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await submit.click();
  } else {
    const named = page.getByRole('button', { name: /iniciar sess[aã]o|entrar|login|acceder/i }).first();
    if (!(await named.isVisible({ timeout: 2_000 }).catch(() => false))) throw new Error('BigBuy login submit button was not found.');
    await named.click();
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await detectBotChallenge(page);

  const currentUrl = page.url();
  const body = cleanText(await page.locator('body').innerText().catch(() => ''));
  if (/\/login\/?(?:\?|$)/i.test(currentUrl) && /(introdu.*email|palavra-passe|contrase[nñ]a|password)/i.test(body)) {
    throw new Error('BigBuy authentication did not complete. Check the configured account credentials or any account-side verification requirement.');
  }
}

async function scrollForProducts(page) {
  let stableRounds = 0;
  let previous = 0;
  for (let round = 0; round < 18 && stableRounds < 3; round += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);

    const loadMore = page.getByRole('button', { name: /mostrar mais|carregar mais|ver mais|load more|mostrar productos|mais produtos/i }).first();
    if (await loadMore.isVisible({ timeout: 250 }).catch(() => false)) await loadMore.click().catch(() => {});

    const count = await page.locator('a[href*="/pt/shop/product/"]').count();
    if (count <= previous) stableRounds += 1;
    else stableRounds = 0;
    previous = count;
  }
}

async function discoverRoot(page, root, runId) {
  const productUrls = new Set();
  const categoryQueue = [root.url];
  const categorySeen = new Set();
  let pagesVisited = 0;

  while (categoryQueue.length && categorySeen.size < MAX_CATEGORY_PAGES && productUrls.size < MAX_PRODUCTS_PER_ROOT) {
    const url = categoryQueue.shift();
    if (!url || categorySeen.has(url)) continue;
    categorySeen.add(url);

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null);
    if (!response) continue;
    pagesVisited += 1;
    await dismissConsent(page);
    await detectBotChallenge(page);
    await scrollForProducts(page);

    const title = await page.title().catch(() => '');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
    const textPreview = cleanText((await page.locator('body').innerText().catch(() => '')).slice(0, 20_000));

    await db.researchPage.create({
      data: {
        researchRunId: runId,
        sourceKey: 'bigbuy-web',
        url,
        canonicalUrl: canonical ? normalizeUrl(canonical) : normalizeUrl(url),
        pageType: 'CATEGORY',
        httpStatus: response.status(),
        contentType: response.headers()['content-type'] || null,
        title,
        contentHash: sha256(textPreview),
        bytes: Buffer.byteLength(textPreview),
      },
    }).catch(() => {});

    const discovered = await page.evaluate(() => ({
      products: Array.from(document.querySelectorAll('a[href*="/pt/shop/product/"]')).map((a) => a.href),
      categories: Array.from(document.querySelectorAll('a[href*="/pt/shop/category/"]')).map((a) => a.href),
    }));

    for (const productUrl of discovered.products) {
      const normalized = normalizeUrl(productUrl);
      if (normalized.includes('/pt/shop/product/')) productUrls.add(normalized);
      if (productUrls.size >= MAX_PRODUCTS_PER_ROOT) break;
    }

    const rootPath = new URL(root.url).pathname.replace(/\/$/, '');
    for (const categoryUrl of discovered.categories) {
      const normalized = normalizeUrl(categoryUrl);
      const path = new URL(normalized).pathname.replace(/\/$/, '');
      if (path.startsWith(rootPath) && !categorySeen.has(normalized) && !categoryQueue.includes(normalized)) categoryQueue.push(normalized);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { productUrls: [...productUrls].slice(0, MAX_PRODUCTS_PER_ROOT), pagesVisited, categoryPages: categorySeen.size };
}

async function extractProduct(page, url, authenticated) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await dismissConsent(page);
  await detectBotChallenge(page);
  await page.waitForTimeout(700);

  const dom = await page.evaluate(() => {
    const txt = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const jsonLd = [];
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { jsonLd.push(JSON.parse(node.textContent || 'null')); } catch { /* ignore malformed JSON-LD */ }
    }

    const attributes = {};
    for (const row of document.querySelectorAll('table tr')) {
      const cells = row.querySelectorAll('th,td');
      if (cells.length >= 2) {
        const key = txt(cells[0].textContent);
        const value = txt(cells[cells.length - 1].textContent);
        if (key && value && key.length < 160 && value.length < 2_000) attributes[key] = value;
      }
    }
    for (const dt of document.querySelectorAll('dl dt')) {
      const dd = dt.nextElementSibling;
      const key = txt(dt.textContent);
      const value = txt(dd?.textContent);
      if (key && value && key.length < 160 && value.length < 2_000) attributes[key] = value;
    }

    const priceCandidates = Array.from(document.querySelectorAll('[itemprop="price"], [data-price], [class*="price" i]'))
      .slice(0, 80)
      .map((node) => ({
        text: txt(node.textContent),
        context: txt(node.parentElement?.textContent).slice(0, 500),
        dataPrice: node.getAttribute('content') || node.getAttribute('data-price') || '',
        selector: `${node.tagName.toLowerCase()}#${node.id}.${String(node.className || '').replace(/\s+/g, '.')}`.slice(0, 300),
      }))
      .filter((row) => row.text || row.dataPrice);

    const imageUrls = Array.from(document.images)
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '')
      .filter(Boolean)
      .filter((src) => !/(logo|icon|flag|sprite|avatar|payment)/i.test(src));

    const variantRows = [];
    for (const select of document.querySelectorAll('select')) {
      const label = txt(select.getAttribute('aria-label') || select.getAttribute('name') || select.previousElementSibling?.textContent || 'Option');
      const options = Array.from(select.querySelectorAll('option')).map((o) => txt(o.textContent)).filter(Boolean);
      if (options.length > 1) variantRows.push({ name: label.slice(0, 120), options: [...new Set(options)].slice(0, 50) });
    }

    const breadcrumbs = Array.from(document.querySelectorAll('[aria-label*="breadcrumb" i] a, .breadcrumb a, nav.breadcrumb a'))
      .map((a) => txt(a.textContent)).filter(Boolean);

    const bodyText = txt(document.body?.innerText).slice(0, 120_000);
    const description = txt(
      document.querySelector('[itemprop="description"]')?.textContent ||
      document.querySelector('[class*="description" i]')?.textContent ||
      '',
    ).slice(0, 20_000);

    return {
      title: txt(document.querySelector('h1')?.textContent || document.title),
      canonical: document.querySelector('link[rel="canonical"]')?.href || location.href,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      bodyText,
      description,
      attributes,
      priceCandidates,
      imageUrls: [...new Set(imageUrls)].slice(0, 40),
      jsonLd,
      variants: variantRows,
      breadcrumbs,
      htmlLang: document.documentElement.lang || '',
    };
  });

  const flattenJsonLd = (value) => {
    const rows = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node['@type'] === 'Product' || (Array.isArray(node['@type']) && node['@type'].includes('Product'))) rows.push(node);
      if (node['@graph']) walk(node['@graph']);
    };
    walk(value);
    return rows;
  };
  const productJson = dom.jsonLd.flatMap(flattenJsonLd)[0] || {};
  const body = dom.bodyText;
  const attrs = dom.attributes || {};

  const identifier = (labels) => {
    for (const label of labels) {
      const re = new RegExp(`(?:${label})\\s*[:#-]?\\s*([A-Z0-9._\\/-]{4,40})`, 'i');
      const match = body.match(re);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  const sku = cleanText(productJson.sku || identifier(['SKU', 'Refer[eê]ncia', 'Referencia', 'Ref\\.?'])) || null;
  const ean = cleanText(productJson.gtin13 || productJson.gtin || identifier(['EAN(?:-?13)?'])) || null;
  const gtin = cleanText(productJson.gtin || productJson.gtin13 || identifier(['GTIN'])) || null;
  const mpn = cleanText(productJson.mpn || identifier(['MPN'])) || null;
  const brand = cleanText(productJson.brand?.name || productJson.brand || deriveAttribute(attrs, [/marca/i, /brand/i, /fabricante/i])) || null;

  const wholesale = pickWholesalePrice(dom.priceCandidates, authenticated);
  const rawPriceText = dom.priceCandidates.map((row) => `${row.text} ${row.context}`.trim()).filter(Boolean).slice(0, 20).join(' | ').slice(0, 8_000) || null;

  const availabilityMatch = body.match(/(?:disponibilidade|stock|estoque)[^.!\n]{0,160}/i);
  const availabilityText = cleanText(availabilityMatch?.[0] || productJson.offers?.availability || '') || null;

  const exactStockMatch = body.match(/(?:stock|estoque|dispon[ií]ve(?:l|is))[^0-9]{0,50}(\d{1,6})\s*(?:unidades?|units?)/i);
  const exactStock = exactStockMatch ? Number.parseInt(exactStockMatch[1], 10) : null;

  const categoryPath = dom.breadcrumbs.filter((row) => !/p[aá]gina inicial|home/i.test(row));
  const name = cleanText(productJson.name || dom.title).slice(0, 500);
  const description = stripHtml(productJson.description || dom.description || dom.metaDescription).slice(0, 20_000);
  const canonicalUrl = normalizeUrl(dom.canonical || url);
  const sourceProductId = productIdFromUrl(canonicalUrl) || productIdFromUrl(url);

  const record = {
    url: normalizeUrl(url),
    canonicalUrl,
    sourceProductId,
    name,
    brand,
    description,
    categoryPath,
    attributes: attrs,
    images: dom.imageUrls.map(normalizeUrl),
    variants: dom.variants,
    sku,
    ean,
    gtin,
    mpn,
    wholesalePrice: wholesale.amount,
    wholesalePriceConfidence: wholesale.confidence,
    wholesalePriceReason: wholesale.reason,
    currency: wholesale.amount != null ? 'EUR' : null,
    rawPriceText,
    availabilityText,
    exactStock,
    stockKnown: exactStock != null,
    materials: deriveAttribute(attrs, [/material/i, /materiais/i]),
    colours: deriveAttribute(attrs, [/cor$/i, /cores/i, /color/i]),
    dimensions: deriveAttribute(attrs, [/dimens/i, /medidas/i, /tamanho/i]),
    weight: deriveAttribute(attrs, [/peso/i, /weight/i]),
    authenticated,
    httpStatus: response?.status() || null,
    contentType: response?.headers()['content-type'] || null,
    pageTitle: await page.title().catch(() => ''),
    htmlLang: dom.htmlLang,
  };
  record.completenessScore = deriveCompleteness(record);
  record.extractionConfidence = record.sourceProductId && record.name ? (record.sku || record.ean ? 90 : 78) : 55;
  return record;
}

async function persistProduct(runId, sourceId, root, record) {
  const fingerprint = sha256(`bigbuy|${record.sourceProductId || ''}|${record.canonicalUrl}`);
  const sourceData = {
    priceConfidence: record.wholesalePriceConfidence,
    priceReason: record.wholesalePriceReason,
    stockKnown: record.stockKnown,
    exactStock: record.exactStock,
    categoryPath: record.categoryPath,
    locale: record.htmlLang || 'pt',
    authenticated: true,
    observedFrom: 'authorized BigBuy web session',
  };

  const product = await db.researchProduct.create({
    data: {
      researchRunId: runId,
      sourceId,
      sourceUrl: record.url,
      canonicalUrl: record.canonicalUrl,
      sourceProductId: record.sourceProductId,
      sourceProductName: record.name,
      sourceBrand: record.brand,
      sourceCategory: root.name,
      sourceSubcategory: record.categoryPath.at(-2) || record.categoryPath.at(-1) || null,
      sourcePrice: record.wholesalePrice != null ? record.wholesalePrice.toFixed(2) : null,
      sourceCurrency: record.currency,
      rawPriceText: record.rawPriceText,
      observedAt: new Date(),
      sourceAvailability: record.availabilityText,
      sourceSku: record.sku,
      sourceMpn: record.mpn,
      sourceEan: record.ean,
      sourceGtin: record.gtin,
      sourceDescription: record.description,
      sourceMaterials: record.materials,
      sourceColours: record.colours,
      sourceDimensions: record.dimensions,
      sourceWeight: record.weight,
      sourceAttributes: boundedJson(record.attributes, 30_000),
      sourceImageUrls: boundedJson(record.images, 20_000),
      sourceDataJson: boundedJson(sourceData, 8_000),
      productFingerprint: fingerprint,
      researchScore: record.completenessScore,
      scoreBreakdownJson: boundedJson({ completeness: record.completenessScore, extractionConfidence: record.extractionConfidence }, 4_000),
      extractionMethod: 'authenticated-browser-dom+jsonld',
      extractionConfidence: record.extractionConfidence,
      completenessScore: record.completenessScore,
      qualityScore: record.completenessScore,
      imageCount: record.images.length,
      variantCount: record.variants.length,
      duplicateKind: 'UNIQUE',
      status: 'PARSED',
    },
  });

  const relatedWrites = [];
  for (const [position, image] of record.images.slice(0, 30).entries()) {
    relatedWrites.push(db.researchImage.create({ data: {
      researchProductId: product.id,
      sourceKey: 'bigbuy-web',
      sourceUrl: image,
      normalizedUrl: image,
      position,
      type: position === 0 ? 'primary' : 'gallery',
      status: 'DISCOVERED',
    } }));
  }
  for (const [fieldKey, value] of Object.entries(record.attributes).slice(0, 80)) {
    if (!cleanText(value)) continue;
    relatedWrites.push(db.researchAttribute.create({ data: {
      researchProductId: product.id,
      fieldKey: cleanText(fieldKey).slice(0, 300),
      sourceValue: cleanText(value).slice(0, 4_000),
      confidence: 0.9,
    } }));
  }
  for (const [index, variant] of record.variants.slice(0, 30).entries()) {
    relatedWrites.push(db.researchVariant.create({ data: {
      researchProductId: product.id,
      sourceVariantId: `${record.sourceProductId || 'product'}-${index + 1}`,
      name: cleanText(variant.name || `Option ${index + 1}`).slice(0, 300),
      optionsJson: boundedJson(variant.options || [], 8_000),
      currency: record.currency,
    } }));
  }

  const evidence = [
    ['name', record.name, 'html/json-ld', 'h1 / Product.name', 0.95],
    ['sourceProductId', record.sourceProductId, 'url', 'URL suffix', 0.98],
    ['sku', record.sku, 'html/json-ld', 'SKU', record.sku ? 0.9 : 0],
    ['ean', record.ean, 'html/json-ld', 'EAN/GTIN', record.ean ? 0.9 : 0],
  ];
  for (const [field, value, method, selector, confidence] of evidence) {
    if (!value) continue;
    relatedWrites.push(db.researchEvidence.create({ data: {
      researchProductId: product.id,
      field,
      value: String(value).slice(0, 2_000),
      sourceUrl: record.canonicalUrl,
      method,
      selector,
      confidence,
    } }));
  }

  if (relatedWrites.length) await db.$transaction(relatedWrites);
  return product;
}

async function recordError(runId, rootKey, url, stage, error) {
  const message = error instanceof Error ? error.message : String(error);
  await db.researchError.create({ data: {
    researchRunId: runId,
    sourceKey: rootKey,
    url: url || null,
    stage,
    errorType: error instanceof Error ? error.name : 'Error',
    message: message.slice(0, 4_000),
  } }).catch(() => {});
  return message;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
  if (!EMAIL || !PASSWORD) throw new Error('BIGBUY_EMAIL and BIGBUY_PASSWORD must be configured as private environment secrets.');

  console.log('E-com.casa BigBuy authenticated catalogue research');
  console.log(`roots=${ROOTS.map((r) => r.key).join(',')} maxPerRoot=${MAX_PRODUCTS_PER_ROOT}`);
  console.log('Credentials, cookies and wholesale prices will not be printed.');

  await assertRobotsAllowsTargets();
  await ensureResearchTables();

  const source = await db.researchSource.upsert({
    where: { key: 'bigbuy-web' },
    create: {
      key: 'bigbuy-web',
      name: 'BigBuy authenticated web catalogue',
      domain: 'bigbuy.eu',
      homepage: `${BASE}/pt/tiendab2b.html`,
      tier: 1,
      enabled: true,
      priority: 100,
    },
    update: { lastRunAt: new Date(), enabled: true, priority: 100 },
  });

  const run = await db.researchRun.create({
    data: {
      status: 'RUNNING',
      mode: 'authenticated-web-research',
      engine: 'bigbuy-web-v1',
      sourceCount: 1,
      sourcesAttempted: 1,
      configJson: boundedJson({
        roots: ROOTS.map((r) => r.url),
        maxProductsPerRoot: MAX_PRODUCTS_PER_ROOT,
        maxCategoryPages: MAX_CATEGORY_PAGES,
        requestDelayMs: REQUEST_DELAY_MS,
      }),
      notes: 'Authorized BigBuy account web research; no API key used; no public Product promotion.',
    },
  });

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  let pagesVisited = 0;
  let productPagesVisited = 0;
  let productsDiscovered = 0;
  let productsParsed = 0;
  let productsRejected = 0;
  const errors = [];

  try {
    await authenticate(page);
    console.log('BigBuy authenticated session established.');

    for (const root of ROOTS) {
      console.log(`Discovering ${root.name}…`);
      let discovery;
      try {
        discovery = await discoverRoot(page, root, run.id);
      } catch (error) {
        errors.push(await recordError(run.id, root.key, root.url, 'discovery', error));
        continue;
      }
      pagesVisited += discovery.pagesVisited;
      productsDiscovered += discovery.productUrls.length;
      console.log(`${root.name}: discovered ${discovery.productUrls.length} product URLs across ${discovery.categoryPages} category pages.`);

      for (const [index, url] of discovery.productUrls.entries()) {
        try {
          const record = await extractProduct(page, url, true);
          productPagesVisited += 1;
          if (!record.name || !record.sourceProductId) throw new Error('Critical product identity fields were not found.');

          const pageRow = await db.researchPage.create({ data: {
            researchRunId: run.id,
            sourceKey: 'bigbuy-web',
            url: record.url,
            canonicalUrl: record.canonicalUrl,
            pageType: 'PRODUCT',
            httpStatus: record.httpStatus,
            contentType: record.contentType,
            title: record.pageTitle,
            contentHash: sha256(`${record.name}|${record.description}|${JSON.stringify(record.attributes)}`),
            bytes: Buffer.byteLength(`${record.name}${record.description}${JSON.stringify(record.attributes)}`),
          } }).catch(() => null);

          const product = await persistProduct(run.id, source.id, root, record);
          if (pageRow) await db.researchProduct.update({ where: { id: product.id }, data: { pageId: pageRow.id } });
          productsParsed += 1;

          if ((index + 1) % 10 === 0 || index + 1 === discovery.productUrls.length) {
            console.log(`${root.name}: parsed ${index + 1}/${discovery.productUrls.length}.`);
          }
        } catch (error) {
          productsRejected += 1;
          errors.push(await recordError(run.id, root.key, url, 'extract', error));
        }
        await sleep(REQUEST_DELAY_MS);
      }
    }

    await db.researchRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: productsParsed > 0 ? 'COMPLETED' : 'FAILED',
        sourcesSuccessful: productsParsed > 0 ? 1 : 0,
        pagesVisited,
        productPagesVisited,
        productsDiscovered,
        productsParsed,
        productsNormalized: productsParsed,
        productsRejected,
        productsImported: productsParsed,
        errorsJson: boundedJson(errors.slice(0, 100), 20_000),
        notes: `BigBuy web research only. Parsed ${productsParsed}; no public catalogue promotion performed.`,
      },
    });

    console.log(`Completed. discovered=${productsDiscovered} parsed=${productsParsed} rejected=${productsRejected} categoryPages=${pagesVisited}`);
    console.log(`Research run id: ${run.id}`);
    if (productsParsed === 0) process.exitCode = 2;
  } catch (error) {
    const message = await recordError(run.id, 'bigbuy-web', page.url(), 'run', error);
    await db.researchRun.update({
      where: { id: run.id },
      data: { completedAt: new Date(), status: 'FAILED', errorsJson: boundedJson([message]), notes: 'Authenticated BigBuy web research failed before a safe import completed.' },
    }).catch(() => {});
    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = process.exitCode || 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
