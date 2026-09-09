// ============================================================
// E-com.casa — Product data extractor (JSON-LD first)
// ------------------------------------------------------------
// Extracts publicly exposed structured product data from HTML:
// schema.org/Product JSON-LD first, OpenGraph + microdata
// fallbacks second. Never invents missing fields — absent data
// stays absent so downstream normalization can flag it.
// ============================================================

export interface ExtractedProduct {
  sourceUrl: string;
  sourceProductId?: string;
  sourceProductName?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  price?: string;
  salePrice?: string;
  currency?: string;
  availability?: string;
  sku?: string;
  gtin?: string;
  description?: string;
  materials?: string;
  colours?: string;
  dimensions?: string;
  weight?: string;
  imageUrls: string[];
  attributes: Record<string, string>;
  extractionMethod: 'json-ld' | 'opengraph' | 'microdata' | 'search-snippet';
  raw?: Record<string, unknown>;
}

function scriptJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      try {
        // Tolerate common trailing-comma / control-char issues
        const cleaned = m[1].replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1');
        blocks.push(JSON.parse(cleaned));
      } catch {
        // skip unparseable block
      }
    }
  }
  return blocks;
}

function collectProducts(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectProducts(n, out));
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const type = obj['@type'];
    const types = Array.isArray(type) ? type.map(String) : type ? [String(type)] : [];
    if (types.includes('Product')) out.push(obj);
    for (const key of ['@graph', 'itemListElement', 'mainEntity', 'hasVariant', 'itemReviewed', 'subjectOf']) {
      if (obj[key]) collectProducts(obj[key], out);
    }
  }
}

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item);
      if (s) return s;
    }
  }
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj['@value'] === 'string') return obj['@value'] as string;
    if (typeof obj['name'] === 'string') return obj['name'] as string;
    if (typeof obj['url'] === 'string') return obj['url'] as string;
  }
  return undefined;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOfferPrice(offer: unknown): { price?: string; currency?: string; lowPrice?: string } {
  if (!offer || typeof offer !== 'object') return {};
  const o = offer as Record<string, unknown>;
  if (Array.isArray(offer)) {
    let best: { price?: string; currency?: string; lowPrice?: string } = {};
    for (const item of offer) {
      const r = extractOfferPrice(item);
      if (!best.price && r.price) best = r;
      if (!best.lowPrice && r.lowPrice) best = { ...best, lowPrice: r.lowPrice };
    }
    return best;
  }
  const price = firstString(o.price) ?? firstString(o.lowPrice);
  const currency = firstString(o.priceCurrency);
  const lowPrice = firstString(o.lowPrice);
  return { price: price ?? undefined, currency: currency ?? undefined, lowPrice: lowPrice ?? undefined };
}

/** Extract a product from a product page's HTML (JSON-LD first). */
export function extractProductFromHtml(html: string, sourceUrl: string): ExtractedProduct | null {
  const candidates: Record<string, unknown>[] = [];
  collectProducts(scriptJsonLdBlocks(html), candidates);
  if (candidates.length === 0) {
    // Fallback: OpenGraph metadata
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (ogTitle) {
      return {
        sourceUrl,
        sourceProductName: stripTags(ogTitle),
        description: ogDesc ? stripTags(ogDesc) : undefined,
        imageUrls: ogImage ? [ogImage] : [],
        attributes: {},
        extractionMethod: 'opengraph',
      };
    }
    // Fallback: <h1>
    const h1 = html.match(/<h1[^>]*>([\s\S]{5,300}?)<\/h1>/i)?.[1];
    if (h1) {
      return {
        sourceUrl,
        sourceProductName: stripTags(h1),
        imageUrls: [],
        attributes: {},
        extractionMethod: 'microdata',
      };
    }
    return null;
  }

  const p = candidates[0];
  const offers = p['offers'];
  const { price, currency, lowPrice } = extractOfferPrice(offers);
  const brandObj = p['brand'];
  const brand =
    typeof brandObj === 'object' && brandObj !== null ? firstString((brandObj as Record<string, unknown>)['name']) : firstString(brandObj);

  let images: string[] = [];
  const img = p['image'];
  if (typeof img === 'string') images = [img];
  else if (Array.isArray(img)) images = img.map((i) => firstString(i) ?? '').filter(Boolean);
  else if (img && typeof img === 'object') images = [firstString((img as Record<string, unknown>)['url']) ?? ''].filter(Boolean);

  const availabilityRaw = offers && typeof offers === 'object' && !Array.isArray(offers) ? firstString((offers as Record<string, unknown>)['availability']) : undefined;

  return {
    sourceUrl,
    sourceProductId: firstString(p['productID']) ?? firstString(p['sku']) ?? undefined,
    sourceProductName: firstString(p['name']),
    brand: brand ?? undefined,
    price: (price ?? lowPrice) ?? undefined,
    currency: currency ?? undefined,
    availability: availabilityRaw?.includes('InStock') ? 'InStock' : availabilityRaw?.includes('OutOfStock') ? 'OutOfStock' : undefined,
    sku: firstString(p['sku']) ?? undefined,
    gtin: firstString(p['gtin13']) ?? firstString(p['gtin']) ?? undefined,
    description: firstString(p['description']) ? stripTags(firstString(p['description'])!) : undefined,
    imageUrls: images,
    attributes: {},
    extractionMethod: 'json-ld',
    raw: {},
  };
}

/** Build a candidate from a public search-result snippet (search-index metadata). */
export function candidateFromSearchSnippet(opts: {
  sourceKey: string;
  url: string;
  title: string;
  snippet: string;
}): ExtractedProduct {
  const { url, title, snippet } = opts;
  const priceMatch = snippet.match(/(?:€|£|\$)\s?\d{1,4}(?:[.,]\d{2})?/) ?? title.match(/(?:€|£|\$)\s?\d{1,4}(?:[.,]\d{2})?/);
  const price = priceMatch ? priceMatch[0].replace(/[^\d.,]/g, '') : undefined;
  const cleanTitle = stripTags(title)
    // Trim common SERP suffixes
    .replace(/\s*[-|–]\s*[^-|–]*(?:Kave Home|Maisons du Monde|Lampenwelt|Nordic Nest|Ferm Living|Govee|Wall Panel Centre)$/i, '')
    .trim();
  return {
    sourceUrl: url,
    sourceProductName: cleanTitle || title,
    price,
    description: snippet ? stripTags(snippet) : undefined,
    imageUrls: [],
    attributes: {},
    extractionMethod: 'search-snippet',
    raw: { sourceKey: opts.sourceKey },
  };
}
