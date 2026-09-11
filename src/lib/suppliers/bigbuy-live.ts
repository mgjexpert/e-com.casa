import 'server-only';

import { db } from '@/lib/db';

const API_BASE = (process.env.BIGBUY_API_BASE_URL || 'https://api.bigbuy.eu').replace(/\/+$/, '');
const API_KEY = process.env.BIGBUY_API_KEY?.trim() || '';
const ISO = (process.env.BIGBUY_ISO_CODE || 'en').trim().toLowerCase();
const MAX_HANDLING_DAYS = clampInt(process.env.BIGBUY_MAX_HANDLING_DAYS, 4, 0, 30);
const PRICE_MARKUP = clampNumber(process.env.BIGBUY_PRICE_MARKUP, 1.28, 1.01, 5);
const VAT_RATE = clampNumber(process.env.BIGBUY_PRICE_VAT_RATE, 0.23, 0, 0.35);
const CUSTOM_TAXONOMIES = (process.env.BIGBUY_TAXONOMY_IDS || '')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v) && v > 0);

interface Taxonomy {
  id: number;
  name?: string;
}

interface BigBuyProduct {
  id: number;
  sku: string;
  wholesalePrice?: number | string | null;
  retailPrice?: number | string | null;
  active?: number | boolean;
  condition?: string | null;
}

interface StockBucket {
  quantity?: number | string;
  maxHandlingDays?: number | string;
}

interface BigBuyStock {
  id: number;
  stocks?: StockBucket[];
}

export interface BigBuyRefreshResult {
  configured: boolean;
  scanned: number;
  updated: number;
  outOfStock: number;
  priceChanges: number;
  taxonomyFailures: number;
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
  const exVat = Math.max(rrp, wholesale * PRICE_MARKUP);
  return Math.ceil(exVat * (1 + VAT_RATE) * 100) / 100;
}

async function api<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BIGBUY_API_KEY is missing');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'User-Agent': 'E-com.casa/1.0 supplier-live-sync',
    },
    signal: AbortSignal.timeout(45_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BigBuy ${response.status} ${path}: ${text.slice(0, 200)}`);
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

function bigBuyIdFromSku(sku: string): number | null {
  const match = /^EC-BB-(\d+)$/.exec(sku);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Refresh only already-published BigBuy SKUs. This never creates new
 * catalogue rows and never changes compliance/publication status.
 */
export async function refreshBigBuyLiveCatalogue(): Promise<BigBuyRefreshResult> {
  if (!API_KEY) {
    return { configured: false, scanned: 0, updated: 0, outOfStock: 0, priceChanges: 0, taxonomyFailures: 0 };
  }

  const localRows = await db.product.findMany({
    where: { sku: { startsWith: 'EC-BB-' }, isDemo: false },
    select: { id: true, sku: true, priceCents: true, stock: true },
  });
  const localByBigBuyId = new Map<number, (typeof localRows)[number]>();
  for (const row of localRows) {
    const id = bigBuyIdFromSku(row.sku);
    if (id) localByBigBuyId.set(id, row);
  }
  if (!localByBigBuyId.size) {
    return { configured: true, scanned: 0, updated: 0, outOfStock: 0, priceChanges: 0, taxonomyFailures: 0 };
  }

  const roots = await rootTaxonomies();
  const remoteProducts = new Map<number, BigBuyProduct>();
  const remoteStock = new Map<number, number>();
  let taxonomyFailures = 0;

  for (const root of roots) {
    const q = `parentTaxonomy=${encodeURIComponent(String(root.id))}`;
    try {
      const [products, stocks] = await Promise.all([
        api<BigBuyProduct[]>(`/rest/catalog/products.json?${q}`),
        api<BigBuyStock[]>(`/rest/catalog/productsstockbyhandlingdays.json?${q}`),
      ]);
      for (const product of products) {
        if (localByBigBuyId.has(product.id)) remoteProducts.set(product.id, product);
      }
      for (const stock of stocks) {
        if (localByBigBuyId.has(stock.id)) remoteStock.set(stock.id, stockFor(stock));
      }
    } catch (error) {
      taxonomyFailures += 1;
      console.warn(`BigBuy live refresh taxonomy ${root.id} failed`, error instanceof Error ? error.message : 'unknown');
    }
  }

  let updated = 0;
  let outOfStock = 0;
  let priceChanges = 0;

  for (const [bigBuyId, local] of localByBigBuyId.entries()) {
    const remote = remoteProducts.get(bigBuyId);
    // If a product disappeared from successful catalogue responses, do not
    // assume zero stock: a partial remote failure must not wipe local stock.
    if (!remote) continue;

    const active = remote.active === true || Number(remote.active) === 1;
    const isNew = String(remote.condition || 'NEW').toUpperCase() === 'NEW';
    const stock = active && isNew ? (remoteStock.get(bigBuyId) ?? 0) : 0;
    const price = sellingPrice(remote);
    const priceCents = Math.round(price * 100);
    if (priceCents <= 0) continue;

    if (priceCents !== local.priceCents) priceChanges += 1;
    if (stock <= 0) outOfStock += 1;

    await db.product.update({
      where: { id: local.id },
      data: {
        price: price.toFixed(2),
        priceCents,
        stock,
        availability: stock > 0 ? 'inStock' : 'outOfStock',
      },
    });
    updated += 1;
  }

  return {
    configured: true,
    scanned: localByBigBuyId.size,
    updated,
    outOfStock,
    priceChanges,
    taxonomyFailures,
  };
}
