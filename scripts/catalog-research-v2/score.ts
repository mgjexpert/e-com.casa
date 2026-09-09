// ============================================================
// E-com.casa — V2 scoring: extraction confidence (§22),
// completeness (§23) and research quality (§56)
// ============================================================

import type { ExtractedPage } from './extract';

export interface ScoreBreakdown {
  completeness: number;
  completenessWeights: Record<string, { got: number; max: number }>;
  extractionConfidence: number;
  qualityScore: number;
}

const METHOD_CONFIDENCE: Record<string, number> = {
  'json-ld': 0.95,
  microdata: 0.9,
  'embedded-json': 0.85,
  opengraph: 0.8,
  meta: 0.75,
  html: 0.75,
  'source-parser': 0.85,
  'text-fallback': 0.5,
};

export function scoreProduct(
  page: ExtractedPage,
  category: string,
  elec?: { electrical: boolean; battery: boolean; specs: Record<string, string> },
): ScoreBreakdown {
  const m = page.fieldMethods;
  const electrical = elec?.electrical ?? page.electrical;
  const techSpecCount = Object.keys(elec?.specs ?? page.electricalSpecs ?? {}).length;

  // ---- Completeness (§23 weighting, category-aware so a vase is not punished) ----
  const weights: Record<string, { got: number; max: number }> = {
    name: { got: page.title ? 10 : 0, max: 10 },
    description: { got: page.fullDescription || page.shortDescription ? 10 : 0, max: 10 },
    price: { got: page.priceAmount !== undefined ? 10 : 0, max: 10 },
    images: { got: page.gallery.length >= 3 ? 15 : page.gallery.length > 0 ? 9 : 0, max: 15 },
    variants: { got: page.variants.length > 0 ? 10 : category === 'lighting' || category === 'accessories' ? 4 : 0, max: 10 },
    category: { got: page.breadcrumbs && page.breadcrumbs.length > 1 ? 5 : page.category ? 3 : 0, max: 5 },
    material: { got: page.material ? 5 : 0, max: 5 },
    dimensions: { got: page.dimensions ? 10 : 0, max: 10 },
    weight: { got: page.weight ? 5 : 0, max: 5 },
    brand: { got: page.brand ? 5 : 0, max: 5 },
    technical: { got: techSpecCount > 0 ? 5 : !electrical ? 3 : 0, max: 5 }, // non-electrical not punished
    safety: { got: (page.warnings?.length ?? 0) > 0 ? 5 : !electrical ? 3 : 0, max: 5 },
    shipping: { got: page.shippingInfo ? 5 : 0, max: 5 },
  };
  const completeness = Math.min(100, Object.values(weights).reduce((a, w) => a + w.got, 0));

  // ---- Extraction confidence (§22) ----
  let confSum = 0;
  let confN = 0;
  for (const field of ['title', 'price', 'fullDescription', 'sku', 'brand', 'material', 'dimensions'] as const) {
    const method = field === 'material' ? (page.material ? m[page.material ? 'material' : 'fullDescription'] : undefined) : m[field];
    if (method && METHOD_CONFIDENCE[method] !== undefined) {
      confSum += METHOD_CONFIDENCE[method];
      confN++;
    }
  }
  if (page.gallery.length > 0) {
    confSum += METHOD_CONFIDENCE[page.gallery[0].method] ?? 0.7;
    confN++;
  }
  // multiple-layer cross-confirmation boost
  const layers = new Set(Object.values(m));
  const crossConfirm = layers.size >= 2 ? 1.05 : 1;
  const extractionConfidence = confN === 0 ? 0 : Math.min(100, Math.round((confSum / confN) * 100 * crossConfirm));

  // ---- Research quality (§56) ----
  const structured = page.dominantMethod === 'json-ld' || page.dominantMethod === 'microdata' ? 20 : page.dominantMethod === 'embedded-json' ? 14 : 8;
  const qualityScore = Math.min(
    100,
    Math.round(
      completeness * 0.45 +
        extractionConfidence * 0.2 +
        structured +
        Math.min(10, page.gallery.length * 1.5) + // image completeness
        (page.variants.length > 0 ? 8 : 0) +
        (page.priceAmount !== undefined ? 8 : 0),
    ),
  );

  return { completeness, completenessWeights: weights, extractionConfidence, qualityScore };
}
