// ============================================================
// E-com.casa — Research crawler (bounded, one-shot)
// ------------------------------------------------------------
// Generic crawler with per-source configuration:
//   sourceName / allowedDomains / categorySeedUrls /
//   paginationStrategy / productLinkDetection /
//   productExtraction / normalizationOverrides
// Semantic extraction (JSON-LD) first — no brittle selector
// forests. Respect robots.txt. A single failed URL never stops
// the run; blocked sources are marked and skipped.
// ============================================================

import { RESEARCH_CONFIG } from './config';
import type { SourceDefinition } from './sources';
import { politeFetch, recordError, type RequestError } from './http-client';
import { extractProductFromHtml, type ExtractedProduct } from './extractor';

export interface CrawlPageRecord {
  sourceKey: string;
  url: string;
  status: 'success' | 'blocked' | 'failed' | 'skipped';
  reason?: string;
}

export interface CrawlOutcome {
  pages: CrawlPageRecord[];
  products: ExtractedProduct[];
}

/** robots.txt gate — cache per host. Disallow rules honoured conservatively. */
const robotsCache = new Map<string, string[]>();

async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const host = u.origin;
    let rules = robotsCache.get(host);
    if (!rules) {
      const res = await politeFetch(`${host}/robots.txt`);
      rules = [];
      if (res.ok && res.body) {
        let appliesToUs = false;
        for (const line of res.body.split('\n')) {
          const clean = line.split('#')[0].trim();
          if (/^user-agent:/i.test(clean)) {
            appliesToUs = /\*$|E-comCasaCatalogResearch/i.test(clean.split(':')[1] ?? '');
          } else if (appliesToUs && /^disallow:/i.test(clean)) {
            const path = clean.split(':')[1]?.trim();
            if (path && path !== '') rules.push(path);
          }
        }
      }
      robotsCache.set(host, rules);
    }
    const path = u.pathname + (u.search || '');
    return !rules.some((rule) => path.startsWith(rule));
  } catch {
    return true; // robots fetch failure — fail open but keep bounded
  }
}

function detectProductLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"']+)(?:["'][^>]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!/product|p\/|\/p\b|prd|dp\//i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl).toString().split('#')[0];
      links.add(abs);
    } catch {
      // ignore malformed
    }
    if (links.size >= 24) break;
  }
  return [...links];
}

function nextPaginationUrl(html: string, baseUrl: string): string | null {
  const rel = html.match(/rel=["']next["'][^>]*href=["']([^"']+)["']/i) ?? html.match(/href=["']([^"']+)["'][^>]*rel=["']next["']/i);
  if (rel) {
    try {
      return new URL(rel[1], baseUrl).toString();
    } catch {
      return null;
    }
  }
  const pageParam = baseUrl.match(/[?&](page|p)=(\d+)/);
  if (pageParam) {
    const next = String(parseInt(pageParam[2], 10) + 1);
    return baseUrl.replace(pageParam[0], pageParam[0].replace(pageParam[2], next));
  }
  const pagePath = baseUrl.match(/\/page\/(\d+)/);
  if (pagePath) return baseUrl.replace(/\/page\/(\d+)/, `/page/${parseInt(pagePath[1], 10) + 1}`);
  return null;
}

export async function crawlSource(source: SourceDefinition, maxProducts: number): Promise<CrawlOutcome> {
  const pages: CrawlPageRecord[] = [];
  const products: ExtractedProduct[] = [];
  const visited = new Set<string>();
  let queue = [...source.categorySeedUrls];

  if (queue.length === 0) {
    pages.push({ sourceKey: source.key, url: source.homepage, status: 'skipped', reason: 'No category seed URLs configured — search-index provider covers this source.' });
    return { pages, products };
  }

  let pageCount = 0;
  while (queue.length > 0 && pageCount < RESEARCH_CONFIG.limits.maxPagesPerSource && products.length < maxProducts) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    if (!(await isAllowedByRobots(url))) {
      pages.push({ sourceKey: source.key, url, status: 'skipped', reason: 'Disallowed by robots.txt' });
      continue;
    }

    const res = await politeFetch(url);
    pageCount++;
    if (!res.ok || !res.body) {
      pages.push({
        sourceKey: source.key,
        url,
        status: res.error?.errorType === 'blocked' ? 'blocked' : 'failed',
        reason: res.error?.message ?? 'Unknown error',
      });
      const err = res.error as RequestError | undefined;
      if (err && err.errorType === 'blocked') {
        // STOP REQUESTING THIS RESOURCE entirely
        pages.push({ sourceKey: source.key, url: `${source.homepage}/*`, status: 'skipped', reason: 'Source marked BLOCKED — remaining queued URLs for this source skipped.' });
        break;
      }
      continue;
    }
    pages.push({ sourceKey: source.key, url, status: 'success' });

    // Try product extraction on this page (works for product pages via JSON-LD)
    const extracted = extractProductFromHtml(res.body, url);
    if (extracted?.sourceProductName && extracted.price) products.push(extracted);

    // Discover product links from listing pages
    for (const link of detectProductLinks(res.body, url)) {
      if (visited.has(link) || queue.includes(link)) continue;
      if (products.length >= maxProducts) break;
      const linkRes = await politeFetch(link);
      if (linkRes.ok && linkRes.body) {
        const lp = extractProductFromHtml(linkRes.body, link);
        if (lp?.sourceProductName && lp.price) {
          products.push(lp);
          pages.push({ sourceKey: source.key, url: link, status: 'success' });
        }
      } else {
        pages.push({
          sourceKey: source.key,
          url: link,
          status: linkRes.error?.errorType === 'blocked' ? 'blocked' : 'failed',
          reason: linkRes.error?.message,
        });
        if (linkRes.error?.errorType === 'blocked') break;
      }
    }

    // Follow pagination (bounded)
    const next = nextPaginationUrl(res.body, url);
    if (next) queue.push(next);
  }

  return { pages, products };
}

export function recordCrawlErrors(pages: CrawlPageRecord[]): void {
  for (const p of pages) {
    if (p.status === 'blocked' || p.status === 'failed') {
      recordError({
        url: p.url,
        errorType: p.status === 'blocked' ? 'blocked' : 'http-error',
        message: p.reason ?? p.status,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
