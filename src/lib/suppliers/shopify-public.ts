// ============================================================
// E-com.casa — Public Shopify supplier scanner
// ------------------------------------------------------------
// Researches explicitly allow-listed supplier storefronts using
// Shopify's public storefront surface only. No login bypass, no
// private APIs, no checkout scraping and no inventory guessing.
//
// Product detail extraction uses Shopify's documented Ajax Product
// endpoint: /{locale}/products/{product-handle}.js.
// ============================================================

export type ShopifySourceId = 'trendhero' | 'viceni' | 'chickidee' | 'wisfor';

export interface ShopifySupplierSource {
  id: ShopifySourceId;
  name: string;
  origin: string;
  collections: string[];
  currency: 'EUR' | 'GBP';
  market: 'EU' | 'UK' | 'EU_UK';
  commercialModel: string;
  pricingNote: string;
  rightsNote: string;
  priority: number;
}

export const SHOPIFY_SUPPLIER_SOURCES: Record<ShopifySourceId, ShopifySupplierSource> = {
  trendhero: {
    id: 'trendhero',
    name: 'Trendhero B.V.',
    origin: 'https://www.trendhero.nl',
    collections: ['/en/collections/all'],
    currency: 'EUR',
    market: 'EU',
    commercialModel: 'B2B wholesale + dropshipping across Europe from the Netherlands',
    pricingNote: 'Public storefront exposes catalogue and availability, but trade pricing may require B2B login.',
    rightsNote: 'Supplier terms state photos/text/marketing materials may be used only for sale of Trendhero products; obtain/retain the B2B relationship before publication.',
    priority: 1,
  },
  viceni: {
    id: 'viceni',
    name: 'Viceni Limited',
    origin: 'https://www.viceni.com',
    collections: ['/collections/wholesale-homeware', '/collections/wholesale-photo-frames'],
    currency: 'GBP',
    market: 'EU_UK',
    commercialModel: 'Trade-only wholesale; dropshipping available by commercial arrangement',
    pricingNote: 'Wholesale catalogue prices are publicly visible; final trade/drop-ship terms still require supplier confirmation.',
    rightsNote: 'Do not republish supplier photography until commercial media rights are confirmed in writing or in the active trade terms.',
    priority: 2,
  },
  chickidee: {
    id: 'chickidee',
    name: 'Chickidee Wholesale',
    origin: 'https://wholesale.chickidee.co.uk',
    collections: ['/collections/all'],
    currency: 'GBP',
    market: 'UK',
    commercialModel: 'Wholesale + dropshipping through Shopify Collective for Shopify retailers',
    pricingNote: 'Trade pricing is account-gated.',
    rightsNote: 'Approved trade accounts are offered free product photography; Shopify Collective is the stated dropship route.',
    priority: 3,
  },
  wisfor: {
    id: 'wisfor',
    name: 'WisFor',
    origin: 'https://wisforhome.com',
    collections: ['/collections/all'],
    currency: 'EUR',
    market: 'EU_UK',
    commercialModel: 'Wholesale + dropshipping with EU/UK warehouse coverage',
    pricingNote: 'Treat public price as market/reference price until wholesale terms are confirmed.',
    rightsNote: 'Media/reseller rights must be confirmed before publication.',
    priority: 4,
  },
};

interface ShopifyAjaxVariant {
  id?: number | string;
  title?: string;
  price?: number;
  compare_at_price?: number | null;
  available?: boolean;
  sku?: string | null;
  barcode?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  requires_shipping?: boolean;
  taxable?: boolean;
}

interface ShopifyAjaxProduct {
  id?: number | string;
  title?: string;
  handle?: string;
  description?: string;
  vendor?: string;
  type?: string;
  tags?: string[];
  price?: number;
  price_min?: number;
  price_max?: number;
  available?: boolean;
  variants?: ShopifyAjaxVariant[];
  images?: string[];
  featured_image?: string | null;
  url?: string;
}

export interface ShopifyScannedProduct {
  sourceId: ShopifySourceId;
  sourceName: string;
  sourceUrl: string;
  productJsonUrl: string;
  shopifyProductId: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  description: string;
  currency: string;
  priceMinCents: number;
  priceMaxCents: number;
  available: boolean;
  availabilitySignal: 'AVAILABLE' | 'UNAVAILABLE';
  inventoryQuantityKnown: false;
  images: string[];
  variants: Array<{
    id: string;
    title: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    available: boolean;
    sku: string | null;
    barcode: string | null;
    options: string[];
  }>;
}

export interface ShopifyScanResult {
  generatedAt: string;
  engine: 'shopify-public-ajax-v1';
  source: ShopifySupplierSource;
  collectionPagesVisited: number;
  productLinksDiscovered: number;
  productsFetched: number;
  blockedByRobots: boolean;
  warnings: string[];
  products: ShopifyScannedProduct[];
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function normaliseImage(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'User-Agent': 'E-com.casa-SupplierResearch/1.0 (+https://www.e-com.casa)',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

interface RobotsRule {
  kind: 'allow' | 'disallow';
  value: string;
}

/** Shopify robots files use wildcard rules such as /collections/*+*.
 * Evaluate the complete wildcard expression instead of treating the prefix
 * before `*` as blocked, which would incorrectly reject every collection.
 */
function robotsPatternMatches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const anchoredAtEnd = pattern.endsWith('$');
  const raw = anchoredAtEnd ? pattern.slice(0, -1) : pattern;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}${anchoredAtEnd ? '$' : ''}`);
  return re.test(path);
}

function robotsDisallows(robots: string, pathname: string): boolean {
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let rulesStarted = false;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!current || rulesStarted) {
        current = { agents: [], rules: [] };
        groups.push(current);
        rulesStarted = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === 'allow' || key === 'disallow') && current) {
      rulesStarted = true;
      if (value) current.rules.push({ kind: key, value });
    }
  }

  const crawler = 'e-com.casa-supplierresearch';
  const applicable = groups.filter((group) =>
    group.agents.some((agent) => agent === '*' || crawler.startsWith(agent)),
  );

  const matched = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => robotsPatternMatches(rule.value, pathname))
    .sort((a, b) => {
      const specificity = (value: string) => value.replace(/[\*$]/g, '').length;
      const diff = specificity(b.value) - specificity(a.value);
      if (diff !== 0) return diff;
      // RFC-style tie behaviour: the least restrictive rule wins.
      if (a.kind === b.kind) return 0;
      return a.kind === 'allow' ? -1 : 1;
    });

  return matched[0]?.kind === 'disallow';
}

function extractProductPaths(html: string, origin: string): string[] {
  const found = new Set<string>();
  const re = /href\s*=\s*["']([^"']*\/products\/[^"'#?]+)(?:[^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].replace(/&amp;/g, '&');
    try {
      const url = new URL(raw, origin);
      if (url.origin !== origin || !url.pathname.includes('/products/')) continue;
      found.add(url.pathname.replace(/\/$/, ''));
    } catch {
      // Ignore malformed links from theme markup.
    }
  }
  return [...found];
}

function productJsonUrl(origin: string, productPath: string): string {
  const clean = productPath.replace(/\/$/, '').replace(/\.js$/i, '');
  return `${origin}${clean}.js`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapProduct(source: ShopifySupplierSource, path: string, jsonUrl: string, p: ShopifyAjaxProduct): ShopifyScannedProduct | null {
  const handle = String(p.handle || path.split('/').filter(Boolean).pop() || '').trim();
  const title = String(p.title || '').trim();
  if (!handle || !title) return null;

  const variants = Array.isArray(p.variants) ? p.variants : [];
  const priceValues = variants.map((v) => Number(v.price ?? 0)).filter((n) => Number.isFinite(n) && n >= 0);
  const priceMinCents = Number(p.price_min ?? p.price ?? (priceValues.length ? Math.min(...priceValues) : 0));
  const priceMaxCents = Number(p.price_max ?? p.price ?? (priceValues.length ? Math.max(...priceValues) : 0));
  const images = [...new Set([
    ...(p.featured_image ? [p.featured_image] : []),
    ...(Array.isArray(p.images) ? p.images : []),
  ].filter(Boolean).map((url) => normaliseImage(String(url))))];

  const sourceUrl = p.url
    ? new URL(p.url, source.origin).toString()
    : `${source.origin}${path}`;

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl,
    productJsonUrl: jsonUrl,
    shopifyProductId: String(p.id ?? ''),
    handle,
    title,
    vendor: p.vendor ? String(p.vendor) : null,
    productType: p.type ? String(p.type) : null,
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    description: decodeHtmlText(String(p.description ?? '')),
    currency: source.currency,
    priceMinCents: Math.max(0, Math.round(priceMinCents || 0)),
    priceMaxCents: Math.max(0, Math.round(priceMaxCents || 0)),
    available: Boolean(p.available),
    availabilitySignal: p.available ? 'AVAILABLE' : 'UNAVAILABLE',
    inventoryQuantityKnown: false,
    images,
    variants: variants.map((v) => ({
      id: String(v.id ?? ''),
      title: String(v.title ?? 'Default'),
      priceCents: Math.max(0, Math.round(Number(v.price ?? 0) || 0)),
      compareAtPriceCents: v.compare_at_price == null ? null : Math.max(0, Math.round(Number(v.compare_at_price) || 0)),
      available: Boolean(v.available),
      sku: v.sku ? String(v.sku) : null,
      barcode: v.barcode ? String(v.barcode) : null,
      options: [v.option1, v.option2, v.option3].filter((x): x is string => Boolean(x)).map(String),
    })),
  };
}

/**
 * Scan one allow-listed Shopify supplier. Public research only.
 * The returned data is NOT a licence, wholesale agreement or stock quantity.
 */
export async function scanShopifySupplier(
  sourceId: ShopifySourceId,
  options: { limit?: number; maxCollectionPages?: number; delayMs?: number } = {},
): Promise<ShopifyScanResult> {
  const source = SHOPIFY_SUPPLIER_SOURCES[sourceId];
  if (!source) throw new Error('Unknown Shopify supplier source');

  const limit = Math.min(80, Math.max(1, options.limit ?? 24));
  const maxCollectionPages = Math.min(8, Math.max(1, options.maxCollectionPages ?? 3));
  const delayMs = Math.min(2_000, Math.max(250, options.delayMs ?? 450));
  const warnings: string[] = [];
  let blockedByRobots = false;
  let robots = '';

  try {
    robots = await fetchText(`${source.origin}/robots.txt`);
  } catch (error) {
    warnings.push(`robots.txt unavailable: ${(error as Error).message}`);
  }

  const paths = new Set<string>();
  let collectionPagesVisited = 0;

  for (const collection of source.collections) {
    if (robots && robotsDisallows(robots, collection)) {
      blockedByRobots = true;
      warnings.push(`robots.txt disallows collection path ${collection}`);
      continue;
    }
    for (let page = 1; page <= maxCollectionPages && paths.size < limit * 3; page += 1) {
      const url = new URL(collection, source.origin);
      url.searchParams.set('page', String(page));
      try {
        const html = await fetchText(url.toString());
        collectionPagesVisited += 1;
        const discovered = extractProductPaths(html, source.origin);
        if (discovered.length === 0) break;
        for (const productPath of discovered) paths.add(productPath);
      } catch (error) {
        warnings.push(`${url.pathname}?page=${page}: ${(error as Error).message}`);
        break;
      }
      await sleep(delayMs);
    }
  }

  const products: ShopifyScannedProduct[] = [];
  for (const path of [...paths].slice(0, limit)) {
    if (robots && robotsDisallows(robots, path)) {
      blockedByRobots = true;
      continue;
    }
    const jsonUrl = productJsonUrl(source.origin, path);
    try {
      const raw = await fetchText(jsonUrl);
      const mapped = mapProduct(source, path, jsonUrl, JSON.parse(raw) as ShopifyAjaxProduct);
      if (mapped) products.push(mapped);
    } catch (error) {
      warnings.push(`${path}: ${(error as Error).message}`);
    }
    await sleep(delayMs);
  }

  if (products.length === 0 && paths.size > 0) {
    warnings.push('Product links were discovered but no Shopify Ajax product records could be fetched.');
  }
  if (products.some((p) => p.inventoryQuantityKnown === false)) {
    warnings.push('Public Shopify Ajax exposes availability but not trustworthy inventory quantity; do not invent stock levels.');
  }

  return {
    generatedAt: new Date().toISOString(),
    engine: 'shopify-public-ajax-v1',
    source,
    collectionPagesVisited,
    productLinksDiscovered: paths.size,
    productsFetched: products.length,
    blockedByRobots,
    warnings,
    products,
  };
}
