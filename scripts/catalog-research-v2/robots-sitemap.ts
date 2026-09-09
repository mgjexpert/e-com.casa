// ============================================================
// E-com.casa — V2 robots.txt compliance + sitemap discovery
// ------------------------------------------------------------
// Before crawling each domain: robots.txt is fetched and parsed.
// Disallowed paths are never intentionally crawled (prompt §52).
// Sitemap indexes and nested sitemaps are processed (§53).
// ============================================================

import { politeFetch } from './http';
import { V2_CONFIG } from './config';

export interface RobotsStatus {
  domain: string;
  status: 'OK' | 'UNAVAILABLE' | 'BLOCKED';
  disallowAll: boolean;
  disallowedPaths: string[];
  sitemapHints: string[];
  raw?: string;
}

const robotsCache = new Map<string, RobotsStatus>();

export async function getRobots(origin: string): Promise<RobotsStatus> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  const url = `${origin}/robots.txt`;
  const res = await politeFetch(url);
  let status: RobotsStatus;
  if (!res.ok || !res.body) {
    status = {
      domain: origin,
      status: res.error?.errorType === 'blocked' ? 'BLOCKED' : 'UNAVAILABLE',
      disallowAll: false,
      disallowedPaths: [],
      sitemapHints: [],
    };
  } else {
    const lines = res.body.split('\n').map((l) => l.trim());
    let inStar = false;
    const disallowedPaths: string[] = [];
    const sitemapHints: string[] = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey?.toLowerCase().trim();
      const value = rest.join(':').trim();
      if (key === 'user-agent') inStar = value === '*';
      else if (key === 'disallow' && inStar && value) disallowedPaths.push(value);
      else if (key === 'sitemap' && value) sitemapHints.push(value);
    }
    status = {
      domain: origin,
      status: 'OK',
      disallowAll: disallowedPaths.includes('/'),
      disallowedPaths,
      sitemapHints,
      raw: res.body.slice(0, 4000),
    };
  }
  robotsCache.set(origin, status);
  return status;
}

export function isAllowed(robots: RobotsStatus, url: string): boolean {
  if (robots.status === 'BLOCKED' || robots.disallowAll) return false;
  let path = '/';
  try {
    const u = new URL(url);
    path = u.pathname + (u.search || '');
  } catch {
    return false;
  }
  for (const d of robots.disallowedPaths) {
    if (d === '/') return false;
    const clean = d.replace(/\*$/, '');
    if (path.startsWith(clean)) return false;
  }
  return true;
}

// ------------------------------------------------------------
// Sitemap processor (§53): sitemap.xml, indexes, nested, bounded
// ------------------------------------------------------------

export interface SitemapDiscovery {
  urls: string[];
  sitemapsProcessed: string[];
  sitemapsFailed: string[];
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\]]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim());
  return locs;
}

export async function discoverViaSitemaps(
  source: { domain: string; homepage: string; sitemapUrls: string[] },
  robots: RobotsStatus,
): Promise<SitemapDiscovery> {
  const seenSitemaps = new Set<string>();
  const urls: string[] = [];
  const sitemapsProcessed: string[] = [];
  const sitemapsFailed: string[] = [];
  const queue: string[] = [];

  const candidates = [...robots.sitemapHints, ...source.sitemapUrls];
  for (const base of candidates) {
    if (queue.length >= V2_CONFIG.limits.maxSitemapsPerSource) break;
    queue.push(base);
  }

  while (queue.length > 0 && sitemapsProcessed.length < V2_CONFIG.limits.maxSitemapsPerSource) {
    const smUrl = queue.shift()!;
    if (seenSitemaps.has(smUrl)) continue;
    seenSitemaps.add(smUrl);
    const res = await politeFetch(smUrl);
    if (!res.ok || !res.body) {
      sitemapsFailed.push(smUrl);
      continue;
    }
    sitemapsProcessed.push(smUrl);
    const locs = extractLocs(res.body).slice(0, V2_CONFIG.limits.maxUrlsPerSitemap);
    let isIndex = false;
    for (const loc of locs) {
      if (/\.xml(\.gz)?($|\?)/i.test(loc) && /sitemap/i.test(loc)) {
        if (queue.length < V2_CONFIG.limits.maxSitemapsPerSource * 2) queue.push(loc);
        isIndex = true;
      }
    }
    if (!isIndex) {
      for (const loc of locs) urls.push(loc);
    }
    // Prefer product-sitemap style URLs from index first
    if (urls.length >= V2_CONFIG.limits.maxUrlsPerSitemap * 2) break;
  }

  return { urls: [...new Set(urls)], sitemapsProcessed, sitemapsFailed };
}
