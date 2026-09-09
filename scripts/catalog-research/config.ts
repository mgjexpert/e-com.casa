// ============================================================
// E-com.casa — Catalog research pipeline configuration
// ------------------------------------------------------------
// ONE-SHOT market research utility. This is NOT a production
// crawler and must never be exposed as a public route, cron job
// or storefront service.
// ============================================================

export const RESEARCH_CONFIG = {
  /** Polite crawl behaviour */
  request: {
    delayMs: parseInt(process.env.REQUEST_DELAY_MS ?? '1500', 10),
    maxConcurrency: 2,
    timeoutMs: 15_000,
    maxResponseBytes: 1_500_000,
    maxRetries: 2,
    backoffBaseMs: 1200,
    /** Honest, non-disguised UA — no evasion of blocking */
    userAgent: 'E-comCasaCatalogResearch/1.0 (+https://e-com.casa)',
  },

  /** Bounded crawling */
  limits: {
    maxPagesPerSource: parseInt(process.env.MAX_PAGES_PER_SOURCE ?? '8', 10),
    maxProductsPerSource: 60,
    defaultCandidateTarget: 300, // 300–500 target candidates
    maxListingPagesDefault: 20,
  },

  /** Final demo catalogue targets (per master prompt mix) */
  catalogue: {
    target: 120,
    acceptableMinimum: 100,
    maxSharePerSource: 0.25, // no single source > ~25% of final catalogue
    mix: {
      lighting: 20,
      'wall-panels': 15,
      decoration: 18,
      garden: 15,
      outdoor: 12,
      planters: 10,
      'outdoor-privacy': 8,
      organisation: 7,
      'kitchen-dining': 5,
      'gadgets-smart-home': 5,
      accessories: 5,
    } as Record<string, number>,
  },

  /** Selection gate */
  scoring: {
    selectionThreshold: 55, // only strong candidates become demo products
  },

  /** Research providers enabled for this run */
  providers: {
    /** Real search-index discovery (public search results metadata) */
    websearch: process.env.RESEARCH_DISABLE_WEBSEARCH !== '1',
    /** Polite direct HTTP crawling (JSON-LD first) */
    http: process.env.RESEARCH_DISABLE_HTTP !== '1',
  },

  /** Where artifacts land */
  output: {
    researchDataFile: 'data/catalog/research-candidates.json',
    productsFile: 'data/catalog/generated-products.json',
    catalogFile: 'data/catalog/generated-catalog.json',
    relationsFile: 'data/catalog/generated-relations.json',
    bundlesFile: 'data/catalog/generated-bundles.json',
    reportJson: 'reports/catalog-research-report.json',
    reportMd: 'reports/catalog-research-report.md',
  },
} as const;

export type ProviderMode = 'websearch' | 'http';
