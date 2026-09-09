// ============================================================
// E-com.casa — CATALOG SCRAPER V2 configuration
// ------------------------------------------------------------
// One-shot deep product extraction engine. NOT a production
// crawler, NOT a competitor sync system. Manually executable,
// never exposed as a public route, cron job or storefront
// service. Polite, bounded and honest by design.
// ============================================================

export const V2_CONFIG = {
  request: {
    /** Polite delay between requests (ms) */
    delayMs: parseInt(process.env.REQUEST_DELAY_MS ?? '1500', 10),
    /** Hard maximum concurrency (never used to evade blocking) */
    maxConcurrency: 2,
    timeoutMs: 20_000,
    maxResponseBytes: 2_500_000,
    maxRetries: 2,
    backoffBaseMs: 1500,
    /** Honest, non-disguised UA — no evasion of blocking */
    userAgent:
      process.env.RESEARCH_UA ??
      'E-comCasaCatalogResearch/2.0 (one-shot product research; +https://e-com.casa)',
  },

  /** Image handling (research-only assets, never published) */
  images: {
    /** Validate (HEAD) at most N gallery images per product */
    validatePerProduct: 8,
    /** Download at most N validated images per selected product (research-assets/, gitignored) */
    downloadPerProduct: 3,
    /** Lightweight delay for image checks (small CDN requests) */
    imageDelayMs: parseInt(process.env.IMAGE_DELAY_MS ?? '300', 10),
    maxImageBytes: 8_000_000,
    minImageBytes: 2000, // tracking pixels / icons are smaller
  },

  /** Bounded discovery per source */
  limits: {
    /** 30–60 product candidates per source (prompt §45) */
    minProductCandidatesPerSource: 30,
    maxProductCandidatesPerSource: parseInt(process.env.MAX_PRODUCT_PAGES ?? '48', 10),
    /** Listing pages crawled per source when sitemap discovery is insufficient */
    maxListingPagesPerSource: 12,
    maxSitemapsPerSource: 12,
    maxUrlsPerSitemap: 6000,
    /** Global candidate target (prompt §45: up to 500) */
    candidateTarget: parseInt(process.env.CANDIDATE_TARGET ?? '500', 10),
  },

  catalogue: {
    target: 120,
    acceptableMinimum: 100,
    maxSharePerSource: 0.25,
    mix: {
      lighting: 20,
      'wall-panels': 15,
      decoration: 18,
      garden: 15,
      outdoor: 12,
      outdoor_privacy: 8,
      planters: 10,
      organisation: 7,
      'kitchen-dining': 5,
      'gadgets-smart-home': 5,
      accessories: 5,
    } as Record<string, number>,
  },

  providers: {
    /** Public search-index metadata as a DISCOVERY aid (never the extraction source) */
    websearch: process.env.RESEARCH_DISABLE_WEBSEARCH !== '1',
    /** Polite direct HTTP crawling */
    http: process.env.RESEARCH_DISABLE_HTTP !== '1',
    /** Optional browser rendering fallback (only public pages, only if Playwright is installed) */
    browser: process.env.RESEARCH_DISABLE_BROWSER !== '1',
  },

  /** Original copy generation (LLM-first with deterministic fallback) */
  copy: {
    useLlm: process.env.RESEARCH_DISABLE_LLM !== '1',
    cacheFile: 'data/catalog/v2-copy-cache.json',
  },

  output: {
    assetsDir: 'research-assets', // gitignored, research-only
    skuMapFile: 'data/catalog/v2-sku-map.json',
    selectedFile: 'data/catalog/v2-selected-products.json',
    reportJson: 'reports/catalog-scrape-v2-report.json',
    reportMd: 'reports/catalog-scrape-v2-report.md',
    productQualityCsv: 'reports/catalog-product-quality.csv',
    imageReportCsv: 'reports/catalog-image-report.csv',
    missingDataCsv: 'reports/catalog-missing-data.csv',
    topProductsCsv: 'reports/catalog-top-products.csv',
  },
} as const;

export const CATEGORY_PREFIX: Record<string, string> = {
  lighting: 'LIT',
  'wall-panels': 'WAL',
  decoration: 'DEC',
  garden: 'GAR',
  outdoor: 'OUT',
  planters: 'PLA',
  'outdoor-privacy': 'PRI',
  organisation: 'ORG',
  'kitchen-dining': 'KIT',
  'gadgets-smart-home': 'GAD',
  accessories: 'ACC',
};

export const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 1.17,
  USD: 0.92,
  SEK: 0.088,
  DKK: 0.134,
  NOK: 0.085,
  ISK: 0.0068,
  PLN: 0.23,
  CHF: 1.04,
  CZK: 0.04,
};

/** Approximate static FX — marked as approximate, used only for cross-source comparison
 *  and demo price calibration (never presented as supplier pricing). */
export function toEur(amount: number, currency: string): number | null {
  const rate = FX_TO_EUR[currency?.toUpperCase()];
  if (!rate || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * rate * 100) / 100;
}
