// ============================================================
// E-com.casa — V2 deep product page extraction
// ------------------------------------------------------------
// Layered extraction (priority order, prompt §7/§8):
//   1. JSON-LD / Schema.org   2. Microdata   3. Embedded JSON
//   4. OpenGraph / meta       5. HTML (cheerio)             6. text fallback
// Full gallery discovery (§11), variants (§18), structured specs
// with confidence (§19), evidence per field (§21), missing data
// stays null — never invented (§20).
// ============================================================

import * as cheerio from 'cheerio';
import { normalizeImageUrl, pickBestFromSrcset, upscaleImageUrl } from './urls';

// ---------------- Types ----------------

export interface ImageRecord {
  sourceUrl: string;
  position: number;
  type: 'primary' | 'gallery' | 'zoom' | 'variant' | 'thumbnail' | 'unknown';
  method: ExtractionMethod;
}

export interface VariantRecord {
  sourceVariantId?: string;
  name: string;
  options?: Record<string, string>;
  sku?: string;
  price?: string;
  currency?: string;
  availability?: string;
  imageUrls?: string[];
  attributes?: Record<string, unknown>;
}

export interface SpecRecord {
  key: string;
  sourceValue: string;
  normalizedKey?: string;
  normalizedValue?: string;
  confidence: number;
  method: ExtractionMethod;
}

export type ExtractionMethod =
  | 'json-ld'
  | 'microdata'
  | 'embedded-json'
  | 'opengraph'
  | 'meta'
  | 'html'
  | 'source-parser'
  | 'text-fallback';

export interface ExtractedPage {
  url: string;
  canonicalUrl?: string;
  isProduct: boolean;
  productSignals: string[];

  title?: string;
  subtitle?: string;
  shortDescription?: string;
  fullDescription?: string;
  bulletPoints?: string[];

  brand?: string;
  manufacturer?: string;
  sku?: string;
  mpn?: string;
  gtin?: string;
  ean?: string;
  sourceProductId?: string;

  rawPriceText?: string;
  priceAmount?: number;
  priceCurrency?: string;
  salePriceAmount?: number;
  regularPriceAmount?: number;
  priceUnit?: string;
  taxIncluded?: boolean;
  promotionText?: string;
  availability?: string;

  breadcrumbs?: string[];
  category?: string;
  subcategory?: string;
  collections?: string[];
  tags?: string[];

  variants: VariantRecord[];
  gallery: ImageRecord[];

  specs: SpecRecord[];
  material?: string;
  colour?: string;
  finish?: string;
  dimensions?: string;
  weight?: string;
  care?: string;
  installation?: string;
  shippingInfo?: string;
  warnings?: string[];
  countryOfOrigin?: string;
  electrical: boolean;
  battery: boolean;
  electricalSpecs: Record<string, string>;
  outdoorUse?: boolean;
  reviewCount?: number;
  rating?: number;

  fieldMethods: Record<string, ExtractionMethod>;
  dominantMethod: ExtractionMethod;
}

// ---------------- JSON-LD layer ----------------

interface JsonLdNode {
  '@type'?: string | string[];
  [k: string]: unknown;
}

function parseJsonLdBlocks(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .trim();
    try {
      const parsed = JSON.parse(raw);
      collectNodes(parsed, nodes);
    } catch {
      // tolerate single-line-comment or trailing comma variants
      try {
        const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
        const parsed = JSON.parse(cleaned);
        collectNodes(parsed, nodes);
      } catch {
        /* skip broken block */
      }
    }
  }
  return nodes;
}

function collectNodes(parsed: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(parsed)) {
    for (const p of parsed) collectNodes(p, out);
  } else if (parsed && typeof parsed === 'object') {
    const node = parsed as JsonLdNode;
    out.push(node);
    if (node['@graph']) collectNodes(node['@graph'], out);
    if (Array.isArray(node.itemListElement)) {
      for (const el of node.itemListElement) {
        if (el && typeof el === 'object') collectNodes(el.item ?? el, out);
      }
    }
  }
}

function typeOf(node: JsonLdNode): string[] {
  const t = node['@type'];
  return Array.isArray(t) ? t : t ? [String(t)] : [];
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim();
  if (v && typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    const n = (v as Record<string, unknown>).name;
    if (typeof n === 'string') return n.trim();
  }
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

interface OfferLike {
  price?: number;
  priceCurrency?: string;
  availability?: string;
  rawPriceText?: string;
}

function collectOffers(node: JsonLdNode): OfferLike[] {
  const offers: OfferLike[] = [];
  const pushOffer = (o: unknown): void => {
    if (!o) return;
    if (Array.isArray(o)) {
      o.forEach(pushOffer);
      return;
    }
    if (o && typeof o === 'object') {
      const obj = o as Record<string, unknown>;
      const price = asNumber(obj.price ?? obj.lowPrice ?? obj.highPrice);
      offers.push({
        price,
        priceCurrency: asString(obj.priceCurrency),
        availability: asString(obj.availability),
        rawPriceText: asString(obj.price) ?? undefined,
      });
    }
  };
  pushOffer(node.offers);
  return offers;
}

function extractJsonLd(nodes: JsonLdNode[], page: ExtractedPage, html: string): void {
  const M: ExtractionMethod = 'json-ld';
  for (const node of nodes) {
    const types = typeOf(node);
    const isProduct = types.some((t) => /Product/i.test(t));
    if (isProduct) {
      page.isProduct = true;
      page.productSignals.push('json-ld:Product');
      const name = asString(node.name);
      if (name && !page.title) {
        page.title = name;
        page.fieldMethods.title = M;
      }
      const desc = asString(node.description);
      if (desc && !page.fullDescription) {
        page.fullDescription = desc;
        page.fieldMethods.fullDescription = M;
      }
      const sku = asString(node.sku);
      if (sku && !page.sku) {
        page.sku = sku;
        page.fieldMethods.sku = M;
      }
      const mpn = asString(node.mpn);
      if (mpn && !page.mpn) {
        page.mpn = mpn;
        page.fieldMethods.mpn = M;
      }
      const gtinFields = ['gtin', 'gtin12', 'gtin13', 'gtin14', 'gtin8'];
      for (const f of gtinFields) {
        const g = asString(node[f]);
        if (g && !page.gtin) {
          page.gtin = g;
          if (/^\d{13}$/.test(g)) page.ean = g;
          page.fieldMethods.gtin = M;
        }
      }
      const brand = node.brand ?? node.manufacturer;
      const brandName = asString(brand);
      if (brandName && !page.brand) {
        page.brand = brandName;
        page.fieldMethods.brand = M;
      }
      const prodId = asString(node.productID);
      if (prodId && !page.sourceProductId) page.sourceProductId = prodId;
      const offers = collectOffers(node);
      const first = offers.find((o) => o.price !== undefined);
      if (first?.price !== undefined && page.priceAmount === undefined) {
        page.priceAmount = first.price;
        page.priceCurrency = first.priceCurrency ?? page.priceCurrency;
        page.rawPriceText = first.rawPriceText;
        page.fieldMethods.price = M;
        if (first.availability) {
          page.availability = first.availability.replace(/^https?:\/\/schema\.org\//i, '');
          page.fieldMethods.availability = M;
        }
      }
      const agg = node.aggregateRating as Record<string, unknown> | undefined;
      if (agg) {
        const rc = asNumber(agg.ratingCount ?? argCount(agg));
        const rt = asNumber(agg.ratingValue);
        // research-only metadata — review TEXT is never copied (§9)
        if (rc && page.reviewCount === undefined) page.reviewCount = rc;
        if (rt && page.rating === undefined) page.rating = rt;
      }
      // category hints
      const cat = asString(node.category);
      if (cat && !page.category) page.category = cat;
      // images
      const img = node.image;
      const imgs: string[] = [];
      if (typeof img === 'string') imgs.push(img);
      else if (Array.isArray(img)) {
        for (const i of img) {
          if (typeof i === 'string') imgs.push(i);
          else if (i && typeof i === 'object') {
            const u = asString((i as Record<string, unknown>).url);
            if (u) imgs.push(u);
          }
        }
      }
      for (const u of imgs) {
        addGalleryImage(page, u, M, page.gallery.length === 0 ? 'primary' : 'gallery');
      }
      // additionalProperty → specs
      const ap = node.additionalProperty;
      if (Array.isArray(ap)) {
        for (const p of ap) {
          if (p && typeof p === 'object') {
            const pv = p as Record<string, unknown>;
            const k = asString(pv.name);
            const v = asString(pv.value);
            if (k && v) page.specs.push({ key: k, sourceValue: v, confidence: 0.9, method: M });
          }
        }
      }
      // JSON-LD weight/dimensions
      const weight = node.weight as Record<string, unknown> | undefined;
      if (weight) {
        const wv = asNumber(weight.value);
        const wu = asString(weight.unitCode ?? weight.unitText);
        if (wv && wu && !page.weight) {
          page.weight = wu.toLowerCase().startsWith('k') ? `${wv} kg` : `${wv} g`;
          page.fieldMethods.weight = M;
        }
      }
    }
    if (types.some((t) => /BreadcrumbList/i.test(t))) {
      const items: string[] = [];
      const els = node.itemListElement;
      if (Array.isArray(els)) {
        for (const el of els) {
          if (el && typeof el === 'object') {
            const e = el as Record<string, unknown>;
            const n = asString(e.name) ?? (e.item && typeof e.item === 'object' ? asString((e.item as Record<string, unknown>).name) : undefined);
            if (n) items.push(n);
          }
        }
      }
      if (items.length > 0 && (page.breadcrumbs?.length ?? 0) < items.length) {
        page.breadcrumbs = items;
        page.fieldMethods.breadcrumbs = M;
      }
    }
  }

  // ProductGroup (variant families)
  for (const node of nodes) {
    if (!typeOf(node).some((t) => /ProductGroup/i.test(t))) continue;
    const varies = node.variesBy;
    const variants = node.hasVariant;
    if (Array.isArray(variants)) {
      for (const v of variants) {
        if (!v || typeof v !== 'object') continue;
        const vn = v as JsonLdNode;
        const name = asString(vn.name) ?? 'Variant';
        const offers = collectOffers(vn);
        const offer = offers[0];
        page.variants.push({
          sourceVariantId: asString(vn.sku) ?? undefined,
          name,
          sku: asString(vn.sku) ?? undefined,
          price: offer?.price !== undefined ? String(offer.price) : undefined,
          currency: offer?.priceCurrency,
          availability: offer?.availability?.replace(/^https?:\/\/schema\.org\//i, ''),
          attributes: Array.isArray(varies) ? { variesBy: varies.map(String) } : undefined,
        });
      }
    }
  }
}

function argCount(agg: Record<string, unknown>): unknown {
  return agg.reviewCount;
}

// ---------------- Gallery helpers ----------------

const ICON_LOGO_RE = /(?:logo|icon|sprite|favicon|placeholder|loader|spinner|badge|flag|payment|trust|banner|avatar|story_|thumb-\d|pixel)/i;
const IMG_EXT_RE = /\.(jpe?g|png|webp|avif)(\?|$)/i;

export function addGalleryImage(
  page: ExtractedPage,
  rawUrl: string,
  method: ExtractionMethod,
  type: ImageRecord['type'],
  baseUrl?: string,
): void {
  let url = rawUrl;
  if (baseUrl) {
    url = normalizeImageUrl(rawUrl, baseUrl);
    if (!url) return;
  }
  if (!url || !IMG_EXT_RE.test(url) && !/\/(image|img|media|photo)/i.test(url)) {
    if (!IMG_EXT_RE.test(url)) return;
  }
  if (ICON_LOGO_RE.test(url)) return;
  if (page.gallery.some((g) => g.sourceUrl === url || g.sourceUrl === upscaleImageUrl(url))) return;
  page.gallery.push({ sourceUrl: url, position: page.gallery.length, type, method });
}

// ---------------- Embedded JSON layer ----------------

function extractEmbeddedJson(html: string, page: ExtractedPage, baseUrl: string): void {
  const M: ExtractionMethod = 'embedded-json';

  // Shopify pattern: var meta = {"product":{...}}
  const shopifyRe = /var\s+meta\s*=\s*(\{[\s\S]{0,20000}?\});/;
  const sm = html.match(shopifyRe);
  if (sm) {
    try {
      const meta = JSON.parse(sm[1]);
      const product = meta?.product;
      if (product && typeof product === 'object') {
        const p = product as Record<string, unknown>;
        page.isProduct = true;
        page.productSignals.push('embedded:shopify-meta');
        const id = p.id;
        if (id && !page.sourceProductId) page.sourceProductId = String(id);
        const variants = p.variants;
        if (Array.isArray(variants)) {
          for (const v of variants) {
            if (!v || typeof v !== 'object') continue;
            const vv = v as Record<string, unknown>;
            const optPairs: Record<string, string> = {};
            for (let i = 1; i <= 3; i++) {
              const ov = vv[`option${i}`];
              const on = (p.options as Array<{ name?: string }> | undefined)?.[i - 1]?.name;
              if (ov && on) optPairs[on] = String(ov);
            }
            page.variants.push({
              sourceVariantId: vv.id ? String(vv.id) : undefined,
              name: asString(vv.public_title) || asString(vv.title) || 'Variant',
              sku: asString(vv.sku),
              price: vv.price !== undefined ? String((Number(vv.price) || 0) / 100) : undefined,
              currency: page.priceCurrency,
              availability: vv.available === true ? 'InStock' : vv.available === false ? 'OutOfStock' : undefined,
              options: optPairs,
              imageUrls: typeof vv.featured_image === 'string' ? [vv.featured_image] : undefined,
            });
          }
        }
        if (Array.isArray(p.images)) {
          for (const im of p.images) {
            if (typeof im === 'string') addGalleryImage(page, im, M, 'gallery', baseUrl);
          }
        }
      }
    } catch {
      /* ignore malformed meta */
    }
  }

  // Generic embedded price+sku blobs (public product state)
  if (page.sku === undefined) {
    const skuRe = /"sku"\s*:\s*"([^"]{2,64})"/;
    const skuM = html.match(skuRe);
    if (skuM) {
      page.sku = skuM[1];
      page.fieldMethods.sku = M;
    }
  }
  if (page.priceAmount === undefined) {
    const priceRe = /"price"\s*:\s*"?([\d.,]+)"?/;
    const pm = html.match(priceRe);
    const curRe = /"priceCurrency"\s*:\s*"([A-Z]{3})"/;
    const cm = html.match(curRe);
    if (pm) {
      let n = parsePriceNumber(pm[1]);
      if (n !== null) {
        // Minor-unit guard: "price":4990 themes store cents — confirm against visible text
        if (n >= 1000 && Number.isInteger(n) && confirmVisibleAmount(html, n / 100)) n = n / 100;
        page.priceAmount = n;
        page.rawPriceText = pm[1];
        if (cm) page.priceCurrency = cm[1];
        page.isProduct = page.isProduct || page.title !== undefined;
        page.productSignals.push('embedded:price-json');
        page.fieldMethods.price = M;
      }
    }
  }
  if (page.gtin === undefined) {
    const eanRe = /"(?:ean|gtin|gtin13|barcode)"\s*:\s*"?(\d{8,14})"?/i;
    const em = html.match(eanRe);
    if (em) {
      page.gtin = em[1];
      if (/^\d{13}$/.test(em[1])) page.ean = em[1];
      page.fieldMethods.gtin = M;
    }
  }
  // dataLayer product pushes
  const dlRe = /dataLayer\.push\(\s*(\{[\s\S]{0,8000}?\})\s*\)\s*;/;
  const dm = html.match(dlRe);
  if (dm && page.brand === undefined) {
    try {
      const obj = JSON.parse(dm[1].replace(/,\s*([}\]])/g, '$1'));
      const brand = asString(obj.brand);
      if (brand) {
        page.brand = brand;
        page.fieldMethods.brand = M;
      }
    } catch {
      /* ignore */
    }
  }
}

/** Numeric price from a bare JSON value (already locale-normalized in JSON). */
function parsePriceNumber(raw: string): number | null {
  const cleaned = raw.replace (/[^\d.,]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Confirms a numeric amount is visibly displayed (used to de-minor-unit ambiguous JSON prices). */
function confirmVisibleAmount(html: string, value: number): boolean {
  const s = value.toFixed(2);
  const patterns = [`${s.replace('.', ',')}`, s, `${value}`];
  return patterns.some((p) => html.includes(p));
}

// ---------------- Microdata layer ----------------

function extractMicrodata($: cheerio.CheerioAPI, page: ExtractedPage, baseUrl: string): void {
  const M: ExtractionMethod = 'microdata';
  const scopes = $('[itemtype*="schema.org/Product"]');
  if (scopes.length === 0) return;
  page.isProduct = true;
  page.productSignals.push('microdata:Product');
  const scope = scopes.first();
  const prop = (name: string): string | undefined => {
    const el = scope.find(`[itemprop="${name}"]`).first();
    const v = el.attr('content') ?? el.attr('href') ?? el.attr('src') ?? el.text().trim();
    return v && v.length > 0 ? v.slice(0, 2000) : undefined;
  };
  const name = prop('name');
  if (name && !page.title) {
    page.title = name;
    page.fieldMethods.title = M;
  }
  const img = prop('image');
  if (img) addGalleryImage(page, img, M, 'primary', baseUrl);
  const price = prop('price');
  if (price && page.priceAmount === undefined) {
    const n = parsePriceNumber(price);
    if (n !== null) {
      page.priceAmount = n;
      page.rawPriceText = price;
      page.fieldMethods.price = M;
    }
  }
  const cur = prop('priceCurrency');
  if (cur && !page.priceCurrency) page.priceCurrency = cur;
  const brand = prop('brand');
  if (brand && !page.brand) {
    page.brand = brand;
    page.fieldMethods.brand = M;
  }
  const sku = prop('sku');
  if (sku && !page.sku) {
    page.sku = sku;
    page.fieldMethods.sku = M;
  }
  const desc = prop('description');
  if (desc && !page.fullDescription) {
    page.fullDescription = desc;
    page.fieldMethods.fullDescription = M;
  }
}

// ---------------- OpenGraph / meta layer ----------------

function extractMeta($: cheerio.CheerioAPI, page: ExtractedPage, baseUrl: string): void {
  const metaContent = (sel: string): string | undefined =>
    $(sel).attr('content')?.trim() || undefined;

  const canonical = $('link[rel="canonical"]').attr('href');
  if (canonical) page.canonicalUrl = normalizeUrlBase(canonical, baseUrl);

  const ogTitle = metaContent('meta[property="og:title"]') ?? metaContent('meta[name="twitter:title"]');
  if (ogTitle && !page.title) {
    page.title = decodeEntities(ogTitle);
    page.fieldMethods.title = 'opengraph';
  }
  const ogDesc = metaContent('meta[property="og:description"]') ?? metaContent('meta[name="description"]');
  if (ogDesc && !page.shortDescription) {
    page.shortDescription = decodeEntities(ogDesc).slice(0, 600);
    page.fieldMethods.shortDescription = ogDesc === metaContent('meta[property="og:description"]') ? 'opengraph' : 'meta';
  }
  const ogImage = metaContent('meta[property="og:image"]') ?? metaContent('meta[name="twitter:image"]');
  if (ogImage) addGalleryImage(page, ogImage, 'opengraph', 'primary', baseUrl);

  const ogPrice = metaContent('meta[property="product:price:amount"]') ?? metaContent('meta[property="og:price:amount"]');
  const ogCurrency = metaContent('meta[property="product:price:currency"]') ?? metaContent('meta[property="og:price:currency"]');
  if (ogPrice && page.priceAmount === undefined) {
    const n = parsePriceNumber(ogPrice);
    if (n !== null) {
      page.priceAmount = n;
      page.rawPriceText = ogPrice;
      if (ogCurrency) page.priceCurrency = ogCurrency;
      page.productSignals.push('meta:price');
      page.fieldMethods.price = 'opengraph';
    }
  }
  const ogType = metaContent('meta[property="og:type"]');
  if (ogType === 'product' && !page.isProduct) {
    page.isProduct = true;
    page.productSignals.push('meta:og-type-product');
  }
  // Extra OG images (some sites expose several)
  $('meta[property="og:image:secure_url"], meta[property="og:image"]').each((_i, el) => {
    const c = $(el).attr('content');
    if (c) addGalleryImage(page, c, 'opengraph', 'gallery', baseUrl);
  });
}

function normalizeUrlBase(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

// ---------------- Visible HTML layer ----------------

const PRICE_SELECTORS = [
  '[itemprop="price"]',
  '.product__price',
  '.product-price',
  '.price__current',
  '.price-current',
  '.price .amount',
  '.single-product-price',
  '[data-price]',
  '.price',
];

const DESCRIPTION_SELECTORS = [
  '[itemprop="description"]',
  '.product__description',
  '.product-description',
  '#product-description',
  '[class*="product"] [class*="description"]',
  '.description',
];

const GALLERY_SELECTORS = [
  '[class*="gallery"] img',
  '[class*="product-media"] img',
  '[class*="product-images"] img',
  '[class*="swiper-slide"] img',
  '.product-thumbnails img',
  '[data-gallery] img',
  'figure img',
  '.product img',
];

function extractHtml($: cheerio.CheerioAPI, page: ExtractedPage, baseUrl: string): void {
  const M: ExtractionMethod = 'html';

  // h1 title (strong visible confirmation)
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  if (h1 && h1.length > 3 && h1.length < 160) {
    if (!page.title) {
      page.title = h1;
      page.fieldMethods.title = M;
    } else if (norm(page.title) === norm(h1)) {
      page.productSignals.push('html:h1-match');
    }
  }

  // Price visible
  if (page.priceAmount === undefined) {
    for (const sel of PRICE_SELECTORS) {
      const el = $(sel).first();
      if (el.length === 0) continue;
      const dataPrice = el.attr('data-price') ?? el.attr('content');
      const text = (dataPrice ?? el.text()).replace(/\s+/g, ' ').trim();
      const parsed = parseVisiblePrice(text);
      if (parsed) {
        page.priceAmount = parsed.amount;
        page.rawPriceText = text;
        page.priceCurrency = parsed.currency ?? page.priceCurrency;
        page.taxIncluded = /incl|iva|vat|inkl|ttc/i.test(text) ? true : undefined;
        page.productSignals.push('html:price');
        page.fieldMethods.price = M;
        break;
      }
    }
  }
  // Sale / regular price pairs
  if (page.priceAmount !== undefined) {
    const wasRe = /(?:was|antes|avant|precedemment|statt|regular(?:\s+price)?|old\s*price|prezzo\s+precedente)[^€£$0-9]{0,20}([€£$]?\s?\d[\d.,]*)/i;
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const wasM = bodyText.match(wasRe);
    if (wasM) {
      const wasParsed = parseVisiblePrice(wasM[1]);
      if (wasParsed && wasParsed.amount > (page.priceAmount ?? 0)) {
        page.regularPriceAmount = wasParsed.amount;
        page.salePriceAmount = page.priceAmount;
      }
    }
    const promoM = bodyText.match(/(?:-\s?\d{1,2}\s?%|save\s+[€£$]?\s?\d+)/i);
    if (promoM) page.promotionText = promoM[0];
  }

  // Description
  if (!page.fullDescription) {
    for (const sel of DESCRIPTION_SELECTORS) {
      const el = $(sel).first();
      if (el.length === 0) continue;
      const text = el.text().replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
      if (text.length >= 60) {
        page.fullDescription = text.slice(0, 4000);
        page.fieldMethods.fullDescription = M;
        break;
      }
    }
  }

  // Bullet features
  const bullets: string[] = [];
  $('[class*="feature"] li, [class*="highlight"] li, [itemprop="description"] li, [class*="usp"] li, [class*="benefit"] li').each((_i, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length >= 8 && t.length <= 220 && bullets.length < 12) bullets.push(t);
  });
  if (bullets.length >= 2) page.bulletPoints = bullets;

  // Breadcrumbs (visible)
  if (!page.breadcrumbs || page.breadcrumbs.length === 0) {
    const crumbs: string[] = [];
    $('[class*="breadcrumb"] a, nav[aria-label*="readcrumb"] a, [itemtype*="BreadcrumbList"] a').each((_i, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && t.length < 60 && !/^home$/i.test(t)) crumbs.push(t);
    });
    if (crumbs.length >= 1) {
      page.breadcrumbs = crumbs;
      page.fieldMethods.breadcrumbs = M;
    }
  }

  // Specs tables (th/td, dl/dt/dd, key-value lists)
  const specs = page.specs;
  $('table tr').each((_i, tr) => {
    const th = $(tr).find('th, td:first-child').first().text().replace(/\s+/g, ' ').trim();
    const td = $(tr).find('td:last-child').text().replace(/\s+/g, ' ').trim();
    if (th && td && th.length < 60 && td.length < 220 && th.toLowerCase() !== td.toLowerCase()) {
      if (!specs.some((s) => norm(s.key) === norm(th))) {
        specs.push({ key: th, sourceValue: td, confidence: 0.75, method: M });
      }
    }
  });
  $('dl').each((_i, dl) => {
    const dts = $(dl).find('dt');
    const dds = $(dl).find('dd');
    dts.each((j, dt) => {
      const k = $(dt).text().replace(/\s+/g, ' ').trim();
      const v = $(dds.get(j)).text().replace(/\s+/g, ' ').trim();
      if (k && v && k.length < 60 && v.length < 220 && !specs.some((s) => norm(s.key) === norm(k))) {
        specs.push({ key: k, sourceValue: v, confidence: 0.75, method: M });
      }
    });
  });

  // Availability
  if (!page.availability) {
    const stockEl = $('[class*="stock"], [class*="availability"], [class*="in-stock"], [itemprop="availability"]').first().text();
    const stock = stockEl.replace(/\s+/g, ' ').trim();
    if (stock && stock.length < 80) {
      page.availability = /out\s?of\s?stock|esgotado|nicht\s?lieferbar|indisponible/i.test(stock)
        ? 'OutOfStock'
        : /in\s?stock|em\s?stock|lieferbar|disponible|op\s?voorraad/i.test(stock)
          ? 'InStock'
          : undefined;
      if (page.availability) page.fieldMethods.availability = M;
    }
  }

  // Product page detection: add-to-cart / buy buttons
  const hasBuy =
    $('form[action*="cart"], button[name*="add"], [class*="add-to-cart"], [class*="addtocart"], button[class*="buy"]').length > 0;
  if (hasBuy) page.productSignals.push('html:add-to-cart');

  // Gallery extraction (full discovery — NOT just og:image, §11/§49)
  for (const sel of GALLERY_SELECTORS) {
    $(sel).each((_i, el) => {
      const img = $(el);
      const inProduct =
        img.closest('[class*="product"], main, [itemtype*="Product"], section').length > 0 ||
        sel === 'figure img';
      if (!inProduct) return;
      let url = img.attr('data-zoom') ?? img.attr('data-large_image') ?? img.attr('data-original') ?? img.attr('data-src') ?? '';
      const srcset = img.attr('srcset') ?? img.attr('data-srcset');
      if (!url && srcset) url = pickBestFromSrcset(srcset);
      if (!url) url = img.attr('src') ?? '';
      if (!url || /^data:/i.test(url)) return;
      // skip <source> srcset handled separately below
      addGalleryImage(page, url, M, page.gallery.length === 0 ? 'primary' : 'gallery', baseUrl);
    });
    if (page.gallery.length >= 10) break;
  }
  // <picture><source srcset>
  $('picture source').each((_i, el) => {
    const ss = $(el).attr('srcset');
    if (!ss || page.gallery.length >= 12) return;
    const best = pickBestFromSrcset(ss);
    if (best) addGalleryImage(page, best, M, 'gallery', baseUrl);
  });

  // Care / shipping / installation visible text
  if (!page.care) {
    const careEl = $('[class*="care"], [id*="care"], [class*="maintenance"]').first().text();
    if (careEl && careEl.trim().length > 20) page.care = careEl.trim().slice(0, 600);
  }
  if (!page.shippingInfo) {
    const shipRe = /(?:free\s+shipping|delivery(?:\s+time)?[:\s][^.]{5,120}|versandkostenfrei[^.]{0,80}|livraison\s+offerte[^.]{0,80})/i;
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const sm2 = bodyText.match(shipRe);
    if (sm2) page.shippingInfo = sm2[0].slice(0, 200);
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ---------------- Visible price parser (locale aware) ----------------

export function parseVisiblePrice(raw: string): { amount: number; currency?: string } | null {
  const text = raw.replace(/\u00a0/g, ' ').trim();
  if (!text) return null;
  const currency =
    text.match(/(EUR|GBP|USD|SEK|DKK|NOK|PLN|CHF|CZK)/i)?.[1]?.toUpperCase() ??
    (text.includes('€') ? 'EUR' : text.includes('£') ? 'GBP' : text.includes('$') ? 'USD' : undefined);
  const numMatch = text.match(/(?:[\d]{1,3}(?:[.\s]\d{3})*(?:[,.]\d{1,2})?|[\d]+(?:[.,]\d{1,2})?)/);
  if (!numMatch) return null;
  let s = numMatch[0].replace(/\s/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // whichever comes last is the decimal separator
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    // 1,299 (thousands) vs 49,90 (decimal)
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) s = s.replace(/\./g, '');
    else if (parts.length === 2 && parts[1].length === 3) {
      // "1.299" style thousands marker (3-digit tail) — decimal prices use 2 digits
      s = parts.join('');
    }
  }
  const amount = parseFloat(s);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  return { amount, currency };
}

// ---------------- Entity decode ----------------

function decodeEntities(s: string): string {
  const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&euro;': '€', '&pound;': '£', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…' };
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|euro|pound|mdash|ndash|hellip);/g, (m) => named[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ---------------- Main entry ----------------

export function extractProductPage(html: string, url: string): ExtractedPage {
  const page: ExtractedPage = {
    url,
    isProduct: false,
    productSignals: [],
    variants: [],
    gallery: [],
    specs: [],
    electrical: false,
    battery: false,
    electricalSpecs: {},
    fieldMethods: {},
    dominantMethod: 'text-fallback',
  };

  const $ = cheerio.load(html);

  // Layer 1: JSON-LD
  const nodes = parseJsonLdBlocks(html);
  if (nodes.length > 0) extractJsonLd(nodes, page, html);
  if (page.gallery.length > 0) page.dominantMethod = 'json-ld';

  // Layer 2: microdata
  extractMicrodata($, page, url);

  // Layer 3: embedded JSON
  extractEmbeddedJson(html, page, url);

  // Layer 4: OpenGraph / meta
  extractMeta($, page, url);

  // Layer 5: visible HTML
  extractHtml($, page, url);

  // subtitle: og or heading adjacency
  if (!page.subtitle) {
    const h2adj = $('h1').next('h2, p, [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
    if (h2adj && h2adj.length > 3 && h2adj.length < 120) page.subtitle = h2adj;
  }

  // Normalize gallery URLs + upscale resolution
  const seen = new Set<string>();
  page.gallery = page.gallery
    .map((g) => {
      let u = g.sourceUrl;
      if (!/^https?:/i.test(u)) u = normalizeUrlBase(u, url);
      u = normalizeUrlBase(u, url).split('#')[0];
      return { ...g, sourceUrl: u };
    })
    .filter((g) => {
      const key = upscaleImageUrl(g.sourceUrl).replace(/https?:\/\//, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((g, i) => ({ ...g, position: i }))
    .slice(0, 24);

  // Dominant method = best layer that produced the title/price
  const bestOrder: ExtractionMethod[] = ['json-ld', 'microdata', 'embedded-json', 'opengraph', 'meta', 'html', 'source-parser', 'text-fallback'];
  for (const m of bestOrder) {
    if (Object.values(page.fieldMethods).includes(m)) {
      page.dominantMethod = m;
      break;
    }
  }

  // Product validation (prompt §54): need a real product signal
  const strongSignals =
    page.productSignals.some((s) => s.startsWith('json-ld') || s.startsWith('microdata') || s.includes('shopify-meta')) ||
    (page.title !== undefined && page.priceAmount !== undefined && (hasBuySignal(page) || page.sku !== undefined));
  page.isProduct = page.isProduct && (strongSignals || page.productSignals.length >= 2);

  return page;
}

function hasBuySignal(page: ExtractedPage): boolean {
  return page.productSignals.includes('html:add-to-cart') || page.productSignals.includes('embedded:price-json');
}
