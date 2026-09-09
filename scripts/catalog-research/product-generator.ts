// ============================================================
// E-com.casa — Demo product generator
// ------------------------------------------------------------
// Combines (a) curated, original E-com.casa product archetypes
// with (b) live research intelligence from this run:
//   • matching research candidate → sourceResearchId traceability
//   • observed market price range → demo price calibration
//     (E-com.casa pricing logic — never source sale prices)
// Output: data/catalog/generated-*.json artifacts (idempotent
// seed inputs; no secrets; no third-party copyrighted content).
// ============================================================

import { RESEARCH_CONFIG } from './config';
import type { Archetype } from './catalog-seed/types';
import { LIGHTING } from './catalog-seed/lighting';
import { WALL_PANELS, DECORATION } from './catalog-seed/panels-decor';
import { GARDEN, OUTDOOR, PLANTERS, OUTDOOR_PRIVACY } from './catalog-seed/garden-outdoor';
import { ORGANISATION, KITCHEN_DINING, GADGETS_SMART_HOME, ACCESSORIES } from './catalog-seed/home-essentials';
import type { NormalizedCandidate } from './normalizer';
import type { CatalogAssignment } from './category-mapper';

export interface GeneratedProduct {
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
  shortDescription: string;
  description: string;
  price: string;
  priceCents: number;
  comparePrice: string | null; // always null in demo — no fabricated "was" prices
  currency: 'EUR';
  categorySlug: string;
  subcategorySlugs: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs: string;
  image: string;
  hoverImage: string | null;
  gallery: string;
  imageStatus: 'GENERATED';
  badge: string | null;
  rating: number;
  reviewCount: number; // demo presentation value — reviews are demo-mode
  stock: number;
  availability: 'inStock' | 'lowStock' | 'outOfStock';
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string;
  dimensions: string;
  weight: string | null;
  care: string;
  color: string;
  shippingClass: string;
  variants: Array<{ id: string; type: string; name: string; value: string; priceDeltaCents: number }>;
  electrical: boolean;
  battery: boolean;
  complianceStatus: 'DEMO';
  reviewMode: 'demo';
  documentationStatus: 'DEMO';
  safetyJson: string;
  requiresComplianceReview: boolean;
  isDemo: true;
  sourceResearchId: string | null;
  sourceDomain: string | null;
  sourceUrl: string | null;
}

const ARCHETYPES: Archetype[] = [
  ...LIGHTING,
  ...WALL_PANELS,
  ...DECORATION,
  ...GARDEN,
  ...OUTDOOR,
  ...PLANTERS,
  ...OUTDOOR_PRIVACY,
  ...ORGANISATION,
  ...KITCHEN_DINING,
  ...GADGETS_SMART_HOME,
  ...ACCESSORIES,
];

const CATEGORY_SKU: Record<string, string> = {
  lighting: 'LIT',
  'wall-panels': 'WAL',
  decoration: 'DEC',
  garden: 'GAR',
  outdoor: 'OUT',
  planters: 'PLA',
  'outdoor-privacy': 'PRV',
  organisation: 'ORG',
  'kitchen-dining': 'KIT',
  'gadgets-smart-home': 'SMA',
  accessories: 'ACC',
};

/** Deterministic pseudo-random from a string seed (stable across runs). */
function seeded(seed: string, min: number, max: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const norm = Math.abs(h % 1000) / 1000;
  return Math.round(min + norm * (max - min));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function composeDescription(a: Archetype): string {
  const benefits = a.copy.benefits.map((b) => `· ${b}`).join('\n');
  const specs = `Materials: ${a.materials.join(', ')}. Dimensions: ${a.dimensions}.`;
  const delivery =
    a.shippingClass === 'HEAVY' || a.shippingClass === 'OVERSIZED' || a.shippingClass === 'SPECIAL'
      ? ' Delivery note: this item ships as an oversized package — delivery options and estimated dates are displayed at checkout.'
      : '';
  return [a.copy.intro, '\nWhy it works\n' + benefits, '\nWhere it belongs\n' + a.copy.use, '\nMaterials & specifications\n' + specs, '\nCare\n' + a.care, delivery].join('\n');
}

function safetyJsonFor(sku: string, electrical: boolean): string {
  return JSON.stringify({
    manufacturerName: 'E-com.casa (demo brand presentation)',
    manufacturerAddress: '[MANUFACTURER DETAILS TO BE CONFIRMED FOR PRODUCTION]',
    manufacturerEmail: 'compliance@e-com.casa',
    euResponsiblePerson: '[EU RESPONSIBLE PERSON TO BE CONFIRMED]',
    productIdentifier: sku,
    countryOfOrigin: null,
    warnings: electrical ? ['Electrical product — read the supplied instructions before use.'] : [],
    safetyInstructions: electrical
      ? ['Indoor use unless explicitly rated for outdoor use.', 'Do not exceed the rated load.']
      : [],
    ceMarking: 'DEMO',
    weee: electrical ? 'DEMO' : 'NOT_APPLICABLE',
  });
}

/** Demo review presentation values — clearly demo-mode, no Verified Buyer claims. */
function demoSocialProof(a: Archetype): { rating: number; reviewCount: number } {
  const base = a.isBestSeller ? 1200 : a.featured ? 380 : 90;
  return {
    rating: a.isBestSeller ? 4.8 : a.featured ? 4.7 : seeded(a.key, 44, 49) / 10,
    reviewCount: Math.round(base * (0.75 + seeded(a.key + 'r', 0, 50) / 100)),
  };
}

export interface GenerationInput {
  candidates: Array<{ candidate: NormalizedCandidate; assignment: CatalogAssignment; researchId: string; score: number }>;
  observedPricesByCategory: Map<string, { min: number; max: number; median: number; count: number }>;
}

export interface GenerationResult {
  products: GeneratedProduct[];
  matchedCount: number;
  archetypeOnlyCount: number;
  priceCalibratedCount: number;
}

export function generateCatalogue(input: GenerationInput): GenerationResult {
  const { candidates, observedPricesByCategory } = input;

  // Index candidates by category for matching
  const byCategory = new Map<string, GenerationInput['candidates']>();
  for (const c of candidates) {
    const list = byCategory.get(c.assignment.category) ?? [];
    list.push(c);
    byCategory.set(c.assignment.category, list);
  }
  const usedCandidates = new Set<string>();

  // Price calibration: keep the archetype's commercial positioning but nudge
  // toward the observed market median band (±18%) when real data exists.
  function calibratedPrice(a: Archetype): number {
    const band = observedPricesByCategory.get(a.category);
    if (!band || band.count < 4) return a.priceCents;
    const medianCents = Math.round(band.median * 100);
    const lower = Math.round(medianCents * 0.82);
    const upper = Math.round(medianCents * 1.18);
    if (a.priceCents >= lower && a.priceCents <= upper) return a.priceCents;
    const nudged = Math.min(upper, Math.max(lower, Math.round((a.priceCents + medianCents) / 2)));
    // Keep the value at a sensible .90 ending
    return Math.max(990, Math.round(nudged / 100) * 100 - 10);
  }

  const products: GeneratedProduct[] = [];
  const counters = new Map<string, number>();

  for (const a of ARCHETYPES) {
    counters.set(a.category, (counters.get(a.category) ?? 0) + 1);
    const catIdx = counters.get(a.category)!;
    const sku = `EC-${CATEGORY_SKU[a.category] ?? 'GEN'}-${String(catIdx).padStart(3, '0')}`;
    const slug = slugify(a.name);

    // Find the best-matching unused research candidate for traceability
    const pool = byCategory.get(a.category) ?? [];
    let match: GenerationInput['candidates'][number] | null = null;
    let bestScore = 0;
    for (const item of pool) {
      if (usedCandidates.has(item.researchId)) continue;
      const nameLower = item.candidate.normalized.nameClean.toLowerCase();
      let score = 0;
      for (const kw of a.matchKeywords) {
        const kwLower = kw.toLowerCase();
        if (nameLower.includes(kwLower.split(' ')[0]) && nameLower.includes(kwLower.split(' ').slice(-1)[0])) {
          score += 2;
        } else if (nameLower.includes(kwLower.split(' ')[0])) {
          score += 1;
        }
      }
      score += item.score / 100;
      if (score > bestScore) {
        bestScore = score;
        match = item;
      }
    }
    if (match && bestScore >= 1.5) usedCandidates.add(match.researchId);

    const priceCents = calibratedPrice(a);
    const social = demoSocialProof(a);
    const galleryKey = a.imageKey;
    const hoverExists = GALLERY_HOVER.has(galleryKey);

    products.push({
      sku,
      slug,
      name: a.name,
      subtitle: a.subtitle,
      shortDescription: a.copy.intro,
      description: composeDescription(a),
      price: (priceCents / 100).toFixed(2),
      priceCents,
      comparePrice: null, // demo: never fabricate "was" prices
      currency: 'EUR',
      categorySlug: a.category,
      subcategorySlugs: a.subcategories.join(','),
      spaceSlugs: a.spaces.join(','),
      styleSlugs: a.styles.join(','),
      collectionSlugs: a.collections.join(','),
      image: `/images/product-${galleryKey}.jpg`,
      hoverImage: hoverExists ? `/images/gallery-${galleryKey}-lifestyle.jpg` : null,
      gallery: hoverExists ? `/images/gallery-${galleryKey}-lifestyle.jpg,/images/gallery-${galleryKey}-detail.jpg` : '',
      imageStatus: 'GENERATED',
      badge: a.badge ?? null,
      rating: social.rating,
      reviewCount: social.reviewCount,
      stock: a.shippingClass === 'HEAVY' || a.shippingClass === 'OVERSIZED' ? 18 : seeded(a.key + 's', 22, 60),
      availability: a.isBestSeller ? 'inStock' : seeded(a.key + 'a', 0, 10) > 8 ? 'lowStock' : 'inStock',
      isBestSeller: !!a.isBestSeller,
      isNew: !!a.isNew,
      featured: !!a.featured,
      materials: a.materials.join(', '),
      dimensions: a.dimensions,
      weight: a.weight ?? null,
      care: a.care,
      color: a.colour,
      shippingClass: a.shippingClass,
      variants: (a.variants ?? []).map((v, i) => ({
        id: `${sku}-v${i + 1}`,
        type: v.type,
        name: v.name,
        value: v.value,
        priceDeltaCents: v.deltaCents ?? 0,
      })),
      electrical: !!a.electrical,
      battery: !!a.battery,
      complianceStatus: 'DEMO',
      reviewMode: 'demo',
      documentationStatus: 'DEMO',
      safetyJson: safetyJsonFor(sku, !!a.electrical),
      requiresComplianceReview: !!a.electrical || !!a.battery,
      isDemo: true,
      sourceResearchId: match?.researchId ?? null,
      sourceDomain: match ? domainOf(match.candidate.sourceUrl) : null,
      sourceUrl: match?.candidate.sourceUrl ?? null,
    });
  }

  const matchedCount = products.filter((p) => p.sourceResearchId).length;
  const priceCalibratedCount = products.filter((p) => {
    const a = ARCHETYPES.find((x) => x.name === p.name);
    return a ? calibratedPrice(a) !== a.priceCents : false;
  }).length;

  return {
    products,
    matchedCount,
    archetypeOnlyCount: products.length - matchedCount,
    priceCalibratedCount,
  };
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Image keys that currently have lifestyle+detail gallery pairs. */
export const GALLERY_HOVER = new Set([
  'arched-mirror', 'ceramic-planter', 'ceramic-vase-set', 'fire-pit', 'garden-torch', 'led-table-lamp',
  'linen-cushions', 'oak-wall-shelf', 'outdoor-sofa', 'palm-planter', 'pendant-lamp', 'rattan-chair',
  'seagrass-basket', 'solar-lantern', 'string-lights', 'teak-bench', 'wall-clock', 'wood-slat-panel',
]);

/** Catalogue mix report per category. */
export function mixReport(products: GeneratedProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.categorySlug] = (counts[p.categorySlug] ?? 0) + 1;
  return counts;
}

export { RESEARCH_CONFIG };
