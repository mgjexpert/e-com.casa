// ============================================================
// E-com.casa — V2 source configuration
// ------------------------------------------------------------
// These sites are RESEARCH REFERENCES for market intelligence.
// They are NOT E-com.casa suppliers and no affiliation is
// implied. Each adapter documents: sitemap entry points, public
// category seeds, product URL patterns and parser hints.
// Discovery priority: sitemap → category pages → search-index aid.
// ============================================================

export interface SourceConfigV2 {
  key: string;
  name: string;
  domain: string;
  homepage: string;
  tier: 1 | 2 | 3;
  priority: number;
  enabled: boolean;
  /** Sitemap entry points (processed first — prompt §5/§53) */
  sitemapUrls: string[];
  /** Public category/collection entry points (used when sitemaps are insufficient — §44) */
  categorySeedUrls: string[];
  /** Known product URL patterns (regex on path) */
  productUrlPatterns: RegExp[];
  /** Known category/listing URL patterns */
  categoryUrlPatterns: RegExp[];
  /** URL path fragments that must never be crawled */
  denyPatterns: RegExp[];
  /** Default currency hint when a price has no explicit symbol/code */
  defaultCurrency: string;
  /** Search-index discovery queries (discovery aid only) */
  searchQueries: string[];
  /** Parser hints for source-specific structures */
  parserHints?: {
    platform?: 'shopify' | 'woocommerce' | 'custom';
    /** Product link selector inside listing pages */
    listingLinkSelector?: string;
  };
  notes?: string;
}

const SHOP_TYPOGRAPHY = ['blog', 'journal', 'inspiration', 'about', 'contact', 'help', 'faq', 'terms', 'privacy', 'careers', 'account', 'login', 'cart', 'checkout', 'wishlist', 'newsletter', 'cookie', 'press', 'jobs', 'support', 'customer', 'legal', 'shipping-info', 'delivery', 'returns', 'gift-card', 'service', 'search'];

const COMMON_DENY = new RegExp(`/(?:${SHOP_TYPOGRAPHY.join('|')})(?:/|$|\\?)`, 'i');

export const SOURCES_V2: SourceConfigV2[] = [
  // ---------------- TIER 1 ----------------
  {
    key: 'maisons-du-monde',
    name: 'Maisons du Monde',
    domain: 'maisonsdumonde.com',
    homepage: 'https://www.maisonsdumonde.com',
    tier: 1,
    priority: 92,
    enabled: true,
    sitemapUrls: ['https://www.maisonsdumonde.com/sitemap.xml'],
    categorySeedUrls: [
      'https://www.maisonsdumonde.com/UK/en/c/lighting',
      'https://www.maisonsdumonde.com/UK/en/c/garden',
      'https://www.maisonsdumonde.com/UK/en/c/decoration',
    ],
    productUrlPatterns: [/\/p\//i, /\/UK\/en\/p\//i],
    categoryUrlPatterns: [/\/c\/[a-z0-9-]+/i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:maisonsdumonde.com garden lantern price',
      'site:maisonsdumonde.com rattan pendant lamp',
      'site:maisonsdumonde.com ceramic vase',
      'site:maisonsdumonde.com outdoor cushion',
    ],
    notes: 'Large EU retailer; strong JSON-LD coverage expected.',
  },
  {
    key: 'kave-home',
    name: 'Kave Home',
    domain: 'kavehome.com',
    homepage: 'https://kavehome.com',
    tier: 1,
    priority: 95,
    enabled: true,
    sitemapUrls: ['https://kavehome.com/sitemap.xml', 'https://kavehome.com/es/sitemap.xml'],
    categorySeedUrls: [
      'https://kavehome.com/en/outdoor',
      'https://kavehome.com/en/lighting',
      'https://kavehome.com/en/decoration',
    ],
    productUrlPatterns: [/\/pa\//i, /\/p\//i],
    categoryUrlPatterns: [/\/en\/(outdoor|lighting|decoration|garden)/i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:kavehome.com outdoor planter price',
      'site:kavehome.com wood slat wall panel',
      'site:kavehome.com outdoor lighting solar',
      'site:kavehome.com portable lamp',
    ],
    notes: 'Historically strong bot protection — expect BLOCKED via HTTP; recorded honestly if so.',
  },
  {
    key: 'luxent',
    name: 'Luxent',
    domain: 'luxent.com',
    homepage: 'https://luxent.com',
    tier: 2,
    priority: 65,
    enabled: true,
    sitemapUrls: ['https://luxent.com/sitemap.xml'],
    categorySeedUrls: ['https://luxent.com/collections/all'],
    productUrlPatterns: [/\/products?\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: ['site:luxent.com outdoor furniture lighting'],
    parserHints: { platform: 'shopify' },
    notes: 'The luxent.com domain resolves to a non-shop business in the run environment — expect an honest FAILED record (§90).',
  },
  {
    key: 'lampenwelt',
    name: 'Lampenwelt',
    domain: 'lampenwelt.de',
    homepage: 'https://www.lampenwelt.de',
    tier: 1,
    priority: 90,
    enabled: true,
    sitemapUrls: ['https://www.lampenwelt.de/sitemap.xml'],
    categorySeedUrls: [
      'https://www.lampenwelt.de/aussenleuchten.html',
      'https://www.lampenwelt.de/tischleuchten.html',
    ],
    productUrlPatterns: [/\/p\//i, /\.html$/i],
    categoryUrlPatterns: [/\.html$/i],
    denyPatterns: [COMMON_DENY, /\/checkout/, /\/warenkorb/],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:lampenwelt.de outdoor wall light price',
      'site:lampenwelt.de LED pendant lamp',
      'site:lampenwelt.de solar light garden',
    ],
    notes: 'Lighting specialist; product vs category both end in .html — JSON-LD Product detection decides.',
  },
  {
    key: 'wall-panel-centre',
    name: 'The Wall Panel Centre',
    domain: 'thewallpanelcentre.co.uk',
    homepage: 'https://thewallpanelcentre.co.uk',
    tier: 1,
    priority: 88,
    enabled: true,
    sitemapUrls: ['https://thewallpanelcentre.co.uk/sitemap.xml'],
    categorySeedUrls: [
      'https://thewallpanelcentre.co.uk/collections/all',
      'https://thewallpanelcentre.co.uk/collections/slat-wall-panels',
    ],
    productUrlPatterns: [/\/products\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'GBP',
    searchQueries: [
      'site:thewallpanelcentre.co.uk slatted wall panel oak price',
      'site:thewallpanelcentre.co.uk acoustic wood panel',
    ],
    parserHints: { platform: 'shopify' },
    notes: 'Shopify store (the .co.uk domain is the live one; the .com variant does not resolve).',
  },
  {
    key: 'ferm-living',
    name: 'Ferm Living',
    domain: 'fermliving.com',
    homepage: 'https://fermliving.com',
    tier: 1,
    priority: 86,
    enabled: true,
    sitemapUrls: ['https://fermliving.com/sitemap.xml'],
    categorySeedUrls: [
      'https://fermliving.com/uk/products/lighting',
      'https://fermliving.com/uk/products/decorations',
    ],
    productUrlPatterns: [/\/products\//i],
    categoryUrlPatterns: [/\/products\/(lighting|decorations|plant-pots|kitchen)/i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:fermliving.com ceramic vase price',
      'site:fermliving.com portable lamp',
      'site:fermliving.com plant pot',
    ],
  },

  // ---------------- TIER 2 ----------------
  {
    key: 'nordic-nest',
    name: 'Nordic Nest',
    domain: 'nordicnest.com',
    homepage: 'https://www.nordicnest.com',
    tier: 2,
    priority: 78,
    enabled: true,
    sitemapUrls: ['https://www.nordicnest.com/api/sitemap/en-us/sitemapindex.xml', 'https://www.nordicnest.com/sitemap.xml'],
    categorySeedUrls: [
      'https://www.nordicnest.com/lighting/',
      'https://www.nordicnest.com/decoration/',
    ],
    productUrlPatterns: [/\/brands\/[^/]+\/[^/]+/i, /\/p\//i, /\/products?\//i],
    categoryUrlPatterns: [/\/(lighting|decoration|garden)(\/|$)/i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:nordicnest.com pendant lamp price',
      'site:nordicnest.com planter pot',
      'site:nordicnest.com vase',
    ],
  },
  {
    key: 'morodeco',
    name: 'MoroDeco',
    domain: 'morodeco.com',
    homepage: 'https://morodeco.com',
    tier: 2,
    priority: 70,
    enabled: true,
    sitemapUrls: ['https://morodeco.com/sitemap.xml', 'https://www.morodeco.com/sitemap.xml'],
    categorySeedUrls: ['https://morodeco.com/collections/all', 'https://www.morodeco.com/collections/all'],
    productUrlPatterns: [/\/products?\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: ['site:morodeco.com wall panel wood slat', 'morodeco wall panel'],
    parserHints: { platform: 'shopify' },
  },
  {
    key: 'lewpe',
    name: 'Lewpe',
    domain: 'lewpe.com',
    homepage: 'https://lewpe.com',
    tier: 2,
    priority: 62,
    enabled: true,
    sitemapUrls: ['https://lewpe.com/sitemap.xml', 'https://www.lewpe.com/sitemap.xml'],
    categorySeedUrls: ['https://lewpe.com/collections/all'],
    productUrlPatterns: [/\/products?\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: ['site:lewpe.com home decoration', 'site:lewpe.com vase'],
    parserHints: { platform: 'shopify' },
  },

  // ---------------- TIER 3 ----------------
  {
    key: 'cozy-garden',
    name: 'The Cozy Garden',
    domain: 'thecozygarden.com',
    homepage: 'https://thecozygarden.com',
    tier: 3,
    priority: 55,
    enabled: true,
    sitemapUrls: ['https://thecozygarden.com/sitemap.xml', 'https://www.thecozygarden.com/sitemap.xml'],
    categorySeedUrls: ['https://thecozygarden.com/collections/all'],
    productUrlPatterns: [/\/products?\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: ['site:thecozygarden.com solar lantern garden', 'thecozygarden lantern'],
    parserHints: { platform: 'shopify' },
  },
  {
    key: 'viridian-bay',
    name: 'Viridian Bay',
    domain: 'viridianbay.com',
    homepage: 'https://viridianbay.com',
    tier: 3,
    priority: 52,
    enabled: true,
    sitemapUrls: ['https://viridianbay.com/sitemap.xml', 'https://www.viridianbay.com/sitemap.xml'],
    categorySeedUrls: ['https://viridianbay.com/collections/all'],
    productUrlPatterns: [/\/products?\//i],
    categoryUrlPatterns: [/\/collections\//i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: ['site:viridianbay.com outdoor decor', 'viridian bay outdoor'],
    parserHints: { platform: 'shopify' },
  },
  {
    key: 'govee-eu',
    name: 'Govee EU',
    domain: 'govee.com',
    homepage: 'https://www.govee.com',
    tier: 3,
    priority: 50,
    enabled: true,
    sitemapUrls: ['https://www.govee.com/sitemap.xml', 'https://www.govee.com/eu/sitemap.xml'],
    categorySeedUrls: [
      'https://www.govee.com/eu/c/outdoor-lights',
      'https://www.govee.com/eu/c/smart-lights',
    ],
    productUrlPatterns: [/\/(product|products)\//i, /-p\.html$/i],
    categoryUrlPatterns: [/\/c\/[a-z0-9-]+/i],
    denyPatterns: [COMMON_DENY],
    defaultCurrency: 'EUR',
    searchQueries: [
      'site:govee.com LED strip light outdoor price',
      'site:govee.com smart lighting EU',
      'govee.eu outdoor lights',
    ],
    notes: 'Smart lighting / gadgets reference for the Gadgets & Smart Home mix.',
  },
];

export function getSourcesV2(enabledOnly = true): SourceConfigV2[] {
  return enabledOnly ? SOURCES_V2.filter((s) => s.enabled) : SOURCES_V2;
}

export function getSourceV2(key: string): SourceConfigV2 | undefined {
  return SOURCES_V2.find((s) => s.key === key);
}
