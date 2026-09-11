#!/usr/bin/env bun
// ============================================================
// E-com.casa — BigBuy production catalogue synchroniser
// ------------------------------------------------------------
// Purpose: replace the research/demo catalogue with products that
// have a real supplier, supplier stock, supplier pricing and real
// supplier-provided product photography.
//
// Official API guide endpoints used here:
//   GET /rest/catalog/taxonomies.json
//   GET /rest/catalog/products.json?parentTaxonomy=...
//   GET /rest/catalog/productsinformation.json?isoCode=...&parentTaxonomy=...
//   GET /rest/catalog/productsimages.json?parentTaxonomy=...
//   GET /rest/catalog/productsstockbyhandlingdays.json?parentTaxonomy=...
//
// IMPORTANT: BIGBUY_ASSET_RIGHTS_CONFIRMED=1 must only be set while
// the E-com.casa distributor account has the BigBuy pack/relationship
// that grants commercial use of the supplied media. Without that flag
// the script is preview-only and performs no Product publication.
// ============================================================

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const API_BASE = (process.env.BIGBUY_API_BASE_URL || 'https://api.bigbuy.eu').replace(/\/+$/, '');
const API_KEY = process.env.BIGBUY_API_KEY?.trim() || '';
const ISO = (process.env.BIGBUY_ISO_CODE || 'en').trim().toLowerCase();
const TARGET = clampInt(process.env.BIGBUY_TARGET_PRODUCTS, 220, 20, 1000);
const MIN_STOCK = clampInt(process.env.BIGBUY_MIN_STOCK, 3, 1, 10000);
const MAX_HANDLING_DAYS = clampInt(process.env.BIGBUY_MAX_HANDLING_DAYS, 4, 0, 30);
const PRICE_MARKUP = clampNumber(process.env.BIGBUY_PRICE_MARKUP, 1.28, 1.01, 5);
const VAT_RATE = clampNumber(process.env.BIGBUY_PRICE_VAT_RATE, 0.23, 0, 0.35);
const RIGHTS_CONFIRMED = /^(1|true|yes)$/i.test(process.env.BIGBUY_ASSET_RIGHTS_CONFIRMED || '');
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.BIGBUY_DRY_RUN || '');
const RETIRE_DEMO = !/^(0|false|no)$/i.test(process.env.BIGBUY_RETIRE_DEMO || '1');
const CUSTOM_TAXONOMIES = (process.env.BIGBUY_TAXONOMY_IDS || '')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v) && v > 0);

interface Taxonomy {
  id: number;
  name?: string;
  url?: string;
  parentTaxonomy?: number | null;
  isoCode?: string;
}

interface BigBuyProduct {
  id: number;
  sku: string;
  ean13?: string | null;
  manufacturer?: number | null;
  weight?: number | string | null;
  height?: number | string | null;
  width?: number | string | null;
  depth?: number | string | null;
  wholesalePrice?: number | string | null;
  retailPrice?: number | string | null;
  inShopsPrice?: number | string | null;
  active?: number | boolean;
  attributes?: boolean;
  condition?: string | null;
  logisticClass?: string | null;
  taxRate?: number | string | null;
}

interface BigBuyInfo {
  id: number;
  sku?: string;
  name?: string;
  description?: string;
  url?: string;
  isoCode?: string;
}

interface BigBuyImage {
  id?: number;
  isCover?: boolean | string;
  name?: string;
  url?: string;
  logo?: boolean;
  whiteBackground?: boolean;
}

interface BigBuyImageSet {
  id: number;
  images?: BigBuyImage[];
}

interface StockBucket {
  quantity?: number | string;
  minHandlingDays?: number | string;
  maxHandlingDays?: number | string;
  warehouse?: number | string;
}

interface BigBuyStock {
  id: number;
  sku?: string;
  stocks?: StockBucket[];
}

interface Candidate {
  root: Taxonomy;
  product: BigBuyProduct;
  info: BigBuyInfo;
  images: BigBuyImage[];
  stock: number;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw || '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseFloat(raw || '');
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function number(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function categoryFor(candidate: Candidate): string {
  const text = `${candidate.root.name || ''} ${candidate.info.name || ''} ${stripHtml(candidate.info.description).slice(0, 500)}`.toLowerCase();
  if (/wall panel|wall cladding|acoustic panel|slat panel|revestimiento|panel de pared|panneau mural/.test(text)) return 'wall-panels';
  if (/planter|plant pot|flower pot|cachepot|jardini[eè]re|maceter|vaso para planta/.test(text)) return 'planters';
  if (/privacy|screen|reed fence|bamboo fence|artificial hedge|ocultaci[oó]n/.test(text)) return 'outdoor-privacy';
  if (/garden|outdoor|terrace|patio|balcony|jard[ií]n|exterior|terraza/.test(text)) return 'outdoor';
  if (/lamp|light|lighting|lantern|pendant|applique|l[aâ]mpara|ilumina[cç][aã]o/.test(text)) return 'lighting';
  if (/storage|organis|organizer|basket|shelf|wardrobe|arrum|rangement/.test(text)) return 'organisation';
  if (/kitchen|dining|tableware|plate|bowl|cutlery|serveware|cozinha|cocina/.test(text)) return 'kitchen-dining';
  return 'decoration';
}

function isLowRiskHomeCandidate(candidate: Candidate): boolean {
  const text = `${candidate.root.name || ''} ${candidate.info.name || ''} ${stripHtml(candidate.info.description).slice(0, 800)}`.toLowerCase();
  // Initial launch deliberately avoids higher-regulatory / hazardous /
  // age-sensitive groups. They can be enabled later after compliance data.
  const blocked = [
    /electric|electrical|battery|usb|led|smart|wifi|bluetooth|volt|watt|l[aâ]mpada|lamp|lighting/,
    /fire pit|fireplace|heater|candle|torch|gas|propane|barbecue|bbq|combust/,
    /baby|child|children|toy|kid|infant|beb[eé]|niñ|crian[cç]/,
    /food|drink|alcohol|wine|beer|coffee|tea|supplement|cosmetic/,
    /knife|blade|weapon|taser|pepper spray/,
  ];
  if (blocked.some((re) => re.test(text))) return false;
  if (candidate.product.attributes === true) return false; // v1 production sync: simple SKUs only
  if (String(candidate.product.condition || 'NEW').toUpperCase() !== 'NEW') return false;
  return true;
}

function shippingClass(p: BigBuyProduct): 'SMALL' | 'STANDARD' | 'FRAGILE' | 'OVERSIZED' | 'HEAVY' {
  const w = number(p.weight);
  const maxDim = Math.max(number(p.width), number(p.height), number(p.depth));
  if (w >= 25) return 'HEAVY';
  if (maxDim >= 120 || w >= 12) return 'OVERSIZED';
  if (w > 0 && w <= 1.5 && maxDim > 0 && maxDim <= 45) return 'SMALL';
  return 'STANDARD';
}

function stockFor(row: BigBuyStock | undefined): number {
  if (!row?.stocks) return 0;
  return Math.max(0, Math.floor(row.stocks.reduce((sum, bucket) => {
    const maxDays = number(bucket.maxHandlingDays);
    const qty = number(bucket.quantity);
    return maxDays <= MAX_HANDLING_DAYS ? sum + Math.max(0, qty) : sum;
  }, 0)));
}

function sellingPrice(product: BigBuyProduct): number {
  const wholesale = number(product.wholesalePrice);
  const rrp = number(product.retailPrice);
  // BigBuy wholesale / recommended prices are treated as ex-VAT inputs.
  // The initial catalogue has a configurable VAT-inclusive display price.
  const exVat = Math.max(rrp, wholesale * PRICE_MARKUP);
  return Math.ceil(exVat * (1 + VAT_RATE) * 100) / 100;
}

async function api<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BIGBUY_API_KEY is missing');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'User-Agent': 'E-com.casa/1.0 supplier-sync',
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BigBuy ${response.status} ${path}: ${text.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

async function rootTaxonomies(): Promise<Taxonomy[]> {
  if (CUSTOM_TAXONOMIES.length) {
    return CUSTOM_TAXONOMIES.map((id) => ({ id, name: `Configured taxonomy ${id}` }));
  }
  const roots = await api<Taxonomy[]>(`/rest/catalog/taxonomies.json?firstLevel&isoCode=${encodeURIComponent(ISO)}`);
  const wanted = /(home|house|kitchen|garden|lighting|decoration|casa|cozinha|jardim|ilumina|hogar|cocina|jard[ií]n|maison|cuisine|garten|k[uü]che)/i;
  return roots.filter((t) => wanted.test(t.name || '')).slice(0, 8);
}

async function loadCandidates(root: Taxonomy): Promise<Candidate[]> {
  const q = `parentTaxonomy=${encodeURIComponent(String(root.id))}`;
  const [products, information, imageSets, stocks] = await Promise.all([
    api<BigBuyProduct[]>(`/rest/catalog/products.json?${q}`),
    api<BigBuyInfo[]>(`/rest/catalog/productsinformation.json?isoCode=${encodeURIComponent(ISO)}&${q}`),
    api<BigBuyImageSet[]>(`/rest/catalog/productsimages.json?${q}`),
    api<BigBuyStock[]>(`/rest/catalog/productsstockbyhandlingdays.json?${q}`),
  ]);

  const infos = new Map(information.map((row) => [row.id, row]));
  const images = new Map(imageSets.map((row) => [row.id, (row.images || []).filter((i) => i.url && !i.logo)]));
  const stockMap = new Map(stocks.map((row) => [row.id, row]));

  const candidates: Candidate[] = [];
  for (const product of products) {
    const info = infos.get(product.id);
    const imgs = images.get(product.id) || [];
    const stock = stockFor(stockMap.get(product.id));
    const active = product.active === true || Number(product.active) === 1;
    if (!active || !info?.name || imgs.length === 0 || stock < MIN_STOCK || number(product.wholesalePrice) <= 0) continue;
    const candidate = { root, product, info, images: imgs, stock };
    if (!isLowRiskHomeCandidate(candidate)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

function score(candidate: Candidate): number {
  const imageScore = Math.min(candidate.images.length, 6) * 4;
  const stockScore = Math.min(candidate.stock, 50);
  const descScore = Math.min(stripHtml(candidate.info.description).length / 40, 25);
  const price = sellingPrice(candidate.product);
  const priceScore = price >= 10 && price <= 250 ? 20 : price <= 600 ? 8 : 0;
  return imageScore + stockScore + descScore + priceScore;
}

function chooseBalanced(candidates: Candidate[]): Candidate[] {
  const byCategory = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const category = categoryFor(candidate);
    const rows = byCategory.get(category) || [];
    rows.push(candidate);
    byCategory.set(category, rows);
  }
  for (const rows of byCategory.values()) rows.sort((a, b) => score(b) - score(a));

  const selected: Candidate[] = [];
  const seen = new Set<number>();
  const categories = [...byCategory.keys()];
  let cursor = 0;
  while (selected.length < TARGET && categories.length) {
    const category = categories[cursor % categories.length];
    const rows = byCategory.get(category) || [];
    const next = rows.find((row) => !seen.has(row.product.id));
    if (next) {
      selected.push(next);
      seen.add(next.product.id);
    } else {
      const idx = categories.indexOf(category);
      categories.splice(idx, 1);
      if (!categories.length) break;
      cursor = Math.max(0, cursor - 1);
    }
    cursor += 1;
  }
  return selected;
}

async function publish(selected: Candidate[]): Promise<void> {
  let written = 0;
  for (const [index, candidate] of selected.entries()) {
    const p = candidate.product;
    const info = candidate.info;
    const category = categoryFor(candidate);
    const description = stripHtml(info.description);
    const price = sellingPrice(p);
    const cover = candidate.images.find((image) => image.isCover === true || String(image.isCover).toUpperCase() === 'TRUE') || candidate.images[0];
    const gallery = candidate.images
      .filter((image) => image.url && image.url !== cover.url)
      .slice(0, 7)
      .map((image) => image.url as string);
    const slug = `${slugify(info.name || p.sku)}-bb-${p.id}`;
    const sourceUrl = info.url ? `https://www.bigbuy.eu/${ISO}/${info.url}.html` : 'https://www.bigbuy.eu/';
    const width = number(p.width);
    const depth = number(p.depth);
    const height = number(p.height);
    const dimensions = width || depth || height
      ? [width || null, depth || null, height || null].filter((v) => v !== null).join(' × ') + ' cm'
      : null;
    const sourceMeta = `supplier:bigbuy:${p.id}:sku:${p.sku}:ean:${p.ean13 || ''}`;

    await db.product.upsert({
      where: { sku: `EC-BB-${p.id}` },
      create: {
        sku: `EC-BB-${p.id}`,
        slug,
        name: info.name!,
        subtitle: p.sku,
        shortDescription: description.slice(0, 260),
        description,
        price: price.toFixed(2),
        priceCents: Math.round(price * 100),
        comparePrice: null,
        currency: 'EUR',
        categorySlug: category,
        subcategorySlugs: '',
        spaceSlugs: category === 'outdoor' || category === 'planters' || category === 'outdoor-privacy' ? 'garden,balcony' : 'living-room',
        styleSlugs: '',
        collectionSlugs: '',
        image: cover.url!,
        hoverImage: gallery[0] || null,
        gallery: gallery.join(','),
        imageStatus: 'LICENSED',
        badge: null,
        rating: 0,
        reviewCount: 0,
        stock: candidate.stock,
        availability: candidate.stock > 0 ? 'inStock' : 'outOfStock',
        isBestSeller: false,
        isNew: false,
        featured: index < 24,
        materials: null,
        dimensions,
        weight: number(p.weight) > 0 ? `${number(p.weight)} kg` : null,
        care: null,
        color: null,
        shippingClass: shippingClass(p),
        variantsJson: JSON.stringify([{ id: `bb-${p.id}`, type: 'supplier-sku', name: p.sku, value: p.sku, priceDeltaCents: 0 }]),
        electrical: false,
        battery: false,
        complianceStatus: 'PENDING_REVIEW',
        reviewMode: 'live',
        documentationStatus: 'PENDING',
        safetyJson: null,
        requiresComplianceReview: true,
        isDemo: false,
        sourceResearchId: sourceMeta,
        sourceDomain: 'bigbuy.eu',
        sourceUrl,
        sortOrder: index + 1,
      },
      update: {
        slug,
        name: info.name!,
        subtitle: p.sku,
        shortDescription: description.slice(0, 260),
        description,
        price: price.toFixed(2),
        priceCents: Math.round(price * 100),
        currency: 'EUR',
        categorySlug: category,
        image: cover.url!,
        hoverImage: gallery[0] || null,
        gallery: gallery.join(','),
        imageStatus: 'LICENSED',
        rating: 0,
        reviewCount: 0,
        stock: candidate.stock,
        availability: candidate.stock > 0 ? 'inStock' : 'outOfStock',
        badge: null,
        isBestSeller: false,
        isNew: false,
        featured: index < 24,
        dimensions,
        weight: number(p.weight) > 0 ? `${number(p.weight)} kg` : null,
        shippingClass: shippingClass(p),
        variantsJson: JSON.stringify([{ id: `bb-${p.id}`, type: 'supplier-sku', name: p.sku, value: p.sku, priceDeltaCents: 0 }]),
        complianceStatus: 'PENDING_REVIEW',
        reviewMode: 'live',
        documentationStatus: 'PENDING',
        requiresComplianceReview: true,
        isDemo: false,
        sourceResearchId: sourceMeta,
        sourceDomain: 'bigbuy.eu',
        sourceUrl,
        sortOrder: index + 1,
      },
    });
    written += 1;
  }

  if (RETIRE_DEMO && written >= 20) {
    // Keep research rows for audit, but remove them from customer-facing
    // queries by blocking them once real supplier-backed stock is live.
    const retired = await db.product.updateMany({
      where: { isDemo: true },
      data: { complianceStatus: 'BLOCKED', availability: 'outOfStock', stock: 0 },
    });
    console.log(`Retired ${retired.count} demo products from sale/display.`);
  }

  console.log(`Published/updated ${written} BigBuy supplier products.`);
}

async function main() {
  console.log('E-com.casa BigBuy catalogue sync');
  console.log(`target=${TARGET} minStock=${MIN_STOCK} maxHandlingDays=${MAX_HANDLING_DAYS} locale=${ISO}`);

  if (!API_KEY) {
    console.error('BLOCKED: BIGBUY_API_KEY is not configured.');
    process.exitCode = 2;
    return;
  }

  const roots = await rootTaxonomies();
  if (!roots.length) throw new Error('No eligible BigBuy home/garden root taxonomies found. Set BIGBUY_TAXONOMY_IDS explicitly if required.');
  console.log(`Using taxonomies: ${roots.map((r) => `${r.id}:${r.name || '?'}`).join(', ')}`);

  const all: Candidate[] = [];
  for (const root of roots) {
    try {
      const rows = await loadCandidates(root);
      console.log(`${root.name || root.id}: ${rows.length} eligible simple-SKU candidates`);
      all.push(...rows);
    } catch (error) {
      console.warn(`Taxonomy ${root.id} failed:`, error instanceof Error ? error.message : error);
    }
  }

  const unique = [...new Map(all.map((row) => [row.product.id, row])).values()];
  const selected = chooseBalanced(unique);
  console.log(`Selected ${selected.length} / ${unique.length} supplier-backed candidates.`);

  const preview = selected.slice(0, 25).map((row) => ({
    id: row.product.id,
    supplierSku: row.product.sku,
    name: row.info.name,
    category: categoryFor(row),
    stock: row.stock,
    sellPriceEur: sellingPrice(row.product).toFixed(2),
    images: row.images.length,
  }));
  console.table(preview);

  if (DRY_RUN) {
    console.log('DRY RUN: no database writes.');
    return;
  }
  if (!RIGHTS_CONFIRMED) {
    console.error('BLOCKED: set BIGBUY_ASSET_RIGHTS_CONFIRMED=1 only after the active BigBuy Ecommerce/Marketplace relationship grants commercial media use. No products were published.');
    process.exitCode = 3;
    return;
  }
  if (selected.length < 20) {
    throw new Error(`Only ${selected.length} eligible products found; refusing to replace the storefront catalogue.`);
  }

  await publish(selected);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
