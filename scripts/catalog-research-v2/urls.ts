// ============================================================
// E-com.casa — V2 URL classification & normalization
// ------------------------------------------------------------
// Every discovered URL is classified (PRODUCT | CATEGORY |
// COLLECTION | EDITORIAL | BLOG | BRAND | SEARCH | OTHER) using
// URL patterns, then re-validated on the page itself (§6/§54).
// Product URLs are normalized (tracking params, canonical,
// mobile/AMP variants) without collapsing distinct products.
// ============================================================

import type { SourceConfigV2 } from './sources';

export type UrlPageType =
  | 'PRODUCT'
  | 'CATEGORY'
  | 'COLLECTION'
  | 'EDITORIAL'
  | 'BLOG'
  | 'BRAND'
  | 'SEARCH'
  | 'OTHER';

export function classifyUrl(rawUrl: string, source: SourceConfigV2): UrlPageType {
  let path = '';
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.includes(source.domain)) return 'OTHER';
    path = u.pathname;
    if (u.search && /[?&](s|search|q|query)=/i.test(u.search)) return 'SEARCH';
  } catch {
    return 'OTHER';
  }
  if (source.denyPatterns.some((re) => re.test(path))) {
    if (/\/(blog|journal|news|press)(\/|$)/i.test(path)) return 'BLOG';
    if (/\/(about|contact|careers|press)(\/|$)/i.test(path)) return 'EDITORIAL';
    return 'OTHER';
  }
  if (source.productUrlPatterns.some((re) => re.test(path))) return 'PRODUCT';
  if (/\/(collections?|category|categories|c|shop|department|range)\//i.test(path)) return 'CATEGORY';
  if (source.categoryUrlPatterns.some((re) => re.test(path))) return 'CATEGORY';
  if (/\/(blog|journal|news|press|stories)(\/|$)/i.test(path)) return 'BLOG';
  if (/\/(about|contact|careers|press|brand|brands|story|sustainability)(\/|$)/i.test(path)) return 'BRAND';
  if (/\/(inspiration|lookbook|guide|guides)(\/|$)/i.test(path)) return 'EDITORIAL';
  return 'OTHER';
}

/** Strip tracking parameters while preserving CDN params required for resolution. */
const TRACKING_PARAMS = /^(utm_|gclid|fbclid|msclkid|mc_|ref|source|campaign|medium|term|content|affil|affiliate|tag|srsltid|spm|scid)($.|=.*)?/i;
const KEEP_PARAMS = /^(width|height|quality|format|fit|dpr|auto|crop|q|w|h|fm|bg|size|v|version|rev|s|sw|sh)$/i;

export function normalizeProductUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    // lowercase host, drop default ports, drop hash
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, u.hostname.includes('www.') ? '' : '');
    // mobile / AMP normalization
    u.pathname = u.pathname.replace(/^\/amp(\/)/i, '/');
    u.searchParams.delete('amp');
    // remove tracking params, keep resolution params
    const keep: Array<[string, string]> = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (TRACKING_PARAMS.test(k)) continue;
      if (KEEP_PARAMS.test(k)) keep.push([k, v]);
    }
    // locale duplication: collapse //en/en/ style duplicates only
    u.pathname = u.pathname.replace(/\/([a-z]{2})\/\1\//i, '/$1/');
    u.search = '';
    for (const [k, v] of keep) u.searchParams.set(k, v);
    if (u.searchParams.size === 0) u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

/** Normalize an image URL: absolute, tracking params removed, resolution params kept. */
export function normalizeImageUrl(rawUrl: string, baseUrl: string): string {
  try {
    const abs = new URL(rawUrl, baseUrl);
    if (!/^https?:/i.test(abs.protocol)) return '';
    abs.hash = '';
    const keep: Array<[string, string]> = [];
    for (const [k, v] of abs.searchParams.entries()) {
      if (TRACKING_PARAMS.test(k)) continue;
      keep.push([k, v]);
    }
    abs.search = '';
    for (const [k, v] of keep) abs.searchParams.set(k, v);
    return abs.toString();
  } catch {
    return '';
  }
}

/** Prefer the highest usable resolution from a srcset-style list. */
export function pickBestFromSrcset(srcset: string): string {
  const candidates = srcset
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [url, desc] = part.split(/\s+/);
      const w = desc?.match(/^(\d+)w$/i)?.[1];
      const x = desc?.match(/^([\d.]+)x$/i)?.[1];
      return { url, weight: w ? parseInt(w, 10) : x ? parseFloat(x) * 1000 : 1 };
    })
    .filter((c) => c.url);
  if (candidates.length === 0) return srcset.trim().split(/\s+/)[0] ?? '';
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0].url;
}

/** Upscale common CDN URL patterns toward the original resolution where safe. */
export function upscaleImageUrl(url: string): string {
  // Shopify CDN (_{w}x{h} or ._{size} suffixes)
  let out = url.replace(/_(\d{2,4})x(\d{0,4})\.(jpe?g|png|webp)/i, '.$3');
  // WordPress / WooCommerce (-scaled, -300x300 style suffixes)
  out = out.replace(/-(\d{2,4})x(\d{2,4})\.(jpe?g|png|webp)(\?.*)?$/i, '.$3');
  // Sanity: never produce a URL that changes the path structure beyond size suffixes
  return out;
}
