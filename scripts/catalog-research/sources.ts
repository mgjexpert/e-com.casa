// ============================================================
// E-com.casa — Research sources
// ------------------------------------------------------------
// These sites are RESEARCH REFERENCES for market intelligence
// (categories, product families, price ranges, merchandising
// language). They are NOT E-com.casa suppliers and no commercial
// affiliation is implied. Nothing is copied from them into the
// public storefront.
// ============================================================

export type SourceTier = 1 | 2 | 3;

export interface SourceDefinition {
  key: string;
  name: string;
  domain: string;
  homepage: string;
  tier: SourceTier;
  priority: number;
  enabled: boolean;
  /** Public category/listing pages used as crawl seeds (if HTTP provider allowed) */
  categorySeedUrls: string[];
  /** Keywords used by the search-index discovery provider */
  searchQueries: string[];
  /** Source-specific normalisation hints */
  normalizationOverrides?: {
    currency?: string;
    locale?: string;
  };
  notes?: string;
}

export const SOURCES: SourceDefinition[] = [
  // ---------------- TIER 1 ----------------
  {
    key: 'kave-home',
    name: 'Kave Home',
    domain: 'kavehome.com',
    homepage: 'https://kavehome.com',
    tier: 1,
    priority: 95,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: [
      'site:kavehome.com outdoor planter price',
      'site:kavehome.com wood slat wall panel',
      'site:kavehome.com outdoor lighting solar',
    ],
    normalizationOverrides: { currency: 'EUR' },
    notes: 'Strong bot protection observed historically — expect BLOCKED via HTTP; search-index discovery used instead.',
  },
  {
    key: 'maisons-du-monde',
    name: 'Maisons du Monde',
    domain: 'maisonsdumonde.com',
    homepage: 'https://www.maisonsdumonde.com',
    tier: 1,
    priority: 92,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: [
      'site:maisonsdumonde.com garden lantern',
      'site:maisonsdumonde.com rattan pendant lamp',
      'site:maisonsdumonde.com ceramic vase',
    ],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'lampenwelt',
    name: 'Lampenwelt',
    domain: 'lampenwelt.de',
    homepage: 'https://www.lampenwelt.de',
    tier: 1,
    priority: 90,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: [
      'site:lampenwelt.de outdoor wall light price',
      'site:lampenwelt.de LED pendant lamp',
    ],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'wall-panel-centre',
    name: 'The Wall Panel Centre',
    domain: 'thewallpanelcentre.com',
    homepage: 'https://thewallpanelcentre.com',
    tier: 1,
    priority: 88,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: [
      'site:thewallpanelcentre.com slatted wall panel oak price',
      'site:thewallpanelcentre.com acoustic wood panel',
    ],
    normalizationOverrides: { currency: 'GBP' },
  },
  {
    key: 'ferm-living',
    name: 'Ferm Living',
    domain: 'fermliving.com',
    homepage: 'https://fermliving.com',
    tier: 1,
    priority: 86,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: [
      'site:fermliving.com ceramic vase price',
      'site:fermliving.com portable lamp',
    ],
    normalizationOverrides: { currency: 'EUR' },
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
    categorySeedUrls: [],
    searchQueries: [
      'site:nordicnest.com pendant lamp price',
      'site:nordicnest.com planter pot',
    ],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'morodeco',
    name: 'MoroDeco',
    domain: 'morodeco.com',
    homepage: 'https://morodeco.com',
    tier: 2,
    priority: 70,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: ['site:morodeco.com wall panel wood slat'],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'luxent',
    name: 'Luxent',
    domain: 'luxent.com',
    homepage: 'https://luxent.com',
    tier: 2,
    priority: 65,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: ['site:luxent.com outdoor furniture'],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'lewpe',
    name: 'Lewpe',
    domain: 'lewpe.com',
    homepage: 'https://lewpe.com',
    tier: 2,
    priority: 62,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: ['site:lewpe.com home decoration'],
    normalizationOverrides: { currency: 'EUR' },
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
    categorySeedUrls: [],
    searchQueries: ['site:thecozygarden.com solar lantern garden'],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'viridian-bay',
    name: 'Viridian Bay',
    domain: 'viridianbay.com',
    homepage: 'https://viridianbay.com',
    tier: 3,
    priority: 52,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: ['site:viridianbay.com outdoor decor'],
    normalizationOverrides: { currency: 'EUR' },
  },
  {
    key: 'govee-eu',
    name: 'Govee EU',
    domain: 'govee.com',
    homepage: 'https://www.govee.com',
    tier: 3,
    priority: 50,
    enabled: true,
    categorySeedUrls: [],
    searchQueries: ['site:govee.com LED strip light outdoor price', 'site:govee.com smart lighting'],
    normalizationOverrides: { currency: 'EUR' },
    notes: 'Smart lighting / gadgets reference for the Gadgets & Smart Home mix.',
  },
];

export function getSources(enabledOnly = true): SourceDefinition[] {
  return enabledOnly ? SOURCES.filter((s) => s.enabled) : SOURCES;
}

export function getSource(key: string): SourceDefinition | undefined {
  return SOURCES.find((s) => s.key === key);
}
