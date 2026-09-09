// ============================================================
// E-com.casa — Search-index discovery provider
// ------------------------------------------------------------
// Uses public search-engine result metadata (title, snippet, URL)
// for the configured research sources. This is public search
// metadata — no login, no circumvention, no private APIs.
// Every query is rate-limited and cached to disk so re-runs are
// idempotent and cheap.
// ============================================================

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { SourceDefinition } from './sources';
import { candidateFromSearchSnippet, type ExtractedProduct } from './extractor';

export interface SearchHit {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'catalog', '.research-search-cache.json');

function loadCache(): Record<string, SearchHit[]> {
  try {
    if (existsSync(CACHE_FILE)) return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    // corrupted cache — ignore
  }
  return {};
}

function saveCache(cache: Record<string, SearchHit[]>): void {
  const dir = path.dirname(CACHE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

interface SearchFunctionResultItem {
  url: string;
  name: string;
  snippet?: string;
  host_name?: string;
  rank?: number;
}

function parseJsonFromCliOutput(out: string): SearchFunctionResultItem[] | null {
  // The z-ai CLI may print progress lines (emoji banners, warnings) before/after
  // the JSON payload — extract the outermost JSON array/object defensively.
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(out.slice(start, end + 1)) as SearchFunctionResultItem[];
    } catch {
      // fall through to object attempt
    }
  }
  const oStart = out.indexOf('{');
  const oEnd = out.lastIndexOf('}');
  if (oStart !== -1 && oEnd > oStart) {
    try {
      return JSON.parse(out.slice(oStart, oEnd + 1)) as { data?: SearchFunctionResultItem[] };
    } catch {
      return null;
    }
  }
  return null;
}

function runSearch(query: string, num: number): SearchHit[] {
  try {
    const out = execFileSync('z-ai', ['function', '-n', 'web_search', '-a', JSON.stringify({ query, num })], {
      encoding: 'utf-8',
      timeout: 45_000,
    });
    const parsed = parseJsonFromCliOutput(out);
    if (!parsed) return [];
    const items = Array.isArray(parsed) ? parsed : ((parsed as { data?: SearchFunctionResultItem[] }).data ?? []);
    return items.map((it, i) => ({
      url: it.url,
      name: it.name ?? '',
      snippet: it.snippet ?? '',
      host_name: it.host_name ?? '',
      rank: it.rank ?? i,
    }));
  } catch {
    // Empty/unsupported query (e.g. small sites return 422) — normal condition
    return [];
  }
}

/** Discover product candidates for a source via public search metadata. */
export function discoverViaSearch(source: SourceDefinition, maxPerQuery = 10): ExtractedProduct[] {
  const cache = loadCache();
  const products: ExtractedProduct[] = [];
  const cacheChanged = false;

  for (const query of source.searchQueries) {
    const cacheKey = `${source.key}::${query}`;
    let hits = cache[cacheKey];
    if (!hits) {
      hits = runSearch(query, maxPerQuery);
      if (hits.length === 0 && query.startsWith('site:')) {
        // Some smaller domains have no indexed results for site: queries —
        // retry without the operator and filter by domain below.
        hits = runSearch(query.replace(/^site:\S+\s*/i, ''), maxPerQuery);
      }
      cache[cacheKey] = hits;
    }
    for (const hit of hits) {
      // Keep only results that belong to the source domain (site: queries)
      if (source.searchQueries.some((q) => q.startsWith('site:')) && !hit.host_name.includes(source.domain.split('.')[0])) {
        if (!hit.url.includes(source.domain)) continue;
      }
      if (!hit.name || !hit.url) continue;
      // Only product-looking URLs (skip category/blog/company pages)
      if (/\/(blog|journal|inspiration|about|contact|help|faq|terms|privacy|careers)(\/|$)/i.test(hit.url)) continue;
      products.push(candidateFromSearchSnippet({ sourceKey: source.key, url: hit.url, title: hit.name, snippet: hit.snippet }));
    }
  }

  if (cacheChanged || Object.keys(cache).length > 0) saveCache(cache);
  return products;
}
