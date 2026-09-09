// ============================================================
// E-com.casa — Product research scoring (100-point system)
// ------------------------------------------------------------
//   Margin potential        20
//   Commercial potential    20
//   Visual appeal           15
//   Logistics ease          15
//   Advertising potential   10
//   Return risk             10
//   Bundle potential         5
//   Compliance complexity    5
// Higher is better. Estimates only — never presented as real
// supplier margins.
// ============================================================

import type { NormalizedCandidate } from './normalizer';
import type { CatalogAssignment } from './category-mapper';

export interface ScoreBreakdown {
  marginPotential: number; // /20
  commercialPotential: number; // /20
  visualAppeal: number; // /15
  logisticsEase: number; // /15
  adPotential: number; // /10
  returnRisk: number; // /10 (higher = LOWER risk)
  bundlePotential: number; // /5
  complianceComplexity: number; // /5 (higher = SIMPLER)
  total: number; // /100
}

const HEAVY_CATEGORIES = new Set(['outdoor', 'outdoor-privacy', 'wall-panels']);
const FRAGILE_RE = /glass|ceramic|porcelain|mirror/i;
const AD_FRIENDLY_RE = /panel|slat|light|lamp|lantern|glow|transformation|makeover|mood/i;
const BUNDLE_CATEGORIES = new Set(['lighting', 'planters', 'wall-panels', 'garden', 'decoration', 'outdoor']);

export function scoreCandidate(n: NormalizedCandidate, assignment: CatalogAssignment): ScoreBreakdown {
  const { priceEur, materialsList, dims, weightKg, isBatteryHint, isElectricalHint } = n.normalized;
  const text = `${n.sourceProductName} ${n.sourceDescription ?? ''}`;

  // ---- Margin potential (20) — estimate from category norms + price band + shipping burden
  let margin = 10;
  if (priceEur !== undefined) {
    if (priceEur >= 20 && priceEur <= 150) margin += 6; // sweet spot for home & garden
    else if (priceEur > 150) margin += 3;
    else margin += 2;
  } else {
    margin += 2;
  }
  if (['decoration', 'accessories', 'lighting', 'garden'].includes(assignment.category)) margin += 4; // typically better multipliers
  if (HEAVY_CATEGORIES.has(assignment.category)) margin -= 3; // freight eats margin
  margin = Math.max(0, Math.min(20, margin));

  // ---- Commercial potential (20)
  let commercial = 8;
  if (/set|pack|multi/i.test(n.sourceProductName)) commercial += 2; // gifting / bundles
  if (finalSpacesCount(assignment) >= 2) commercial += 4; // multi-space appeal
  if (['lighting', 'planters', 'organisation', 'garden'].includes(assignment.category)) commercial += 4;
  if (priceEur !== undefined && priceEur <= 60) commercial += 2; // impulse-friendly
  commercial = Math.max(0, Math.min(20, commercial));

  // ---- Visual appeal (15)
  let visual = 7;
  if (n.sourceImageUrls.length > 0) visual += 2;
  if (AD_FRIENDLY_RE.test(text)) visual += 3;
  if (['wall-panels', 'lighting', 'decoration', 'garden'].includes(assignment.category)) visual += 3;
  visual = Math.max(0, Math.min(15, visual));

  // ---- Logistics ease (15)
  let logistics = 10;
  if (dims) {
    const maxDim = Math.max(dims.length ?? 0, dims.width ?? 0, dims.height ?? 0);
    if (maxDim > 200) logistics -= 6;
    else if (maxDim > 120) logistics -= 3;
    else if (maxDim < 40) logistics += 2;
  }
  if (weightKg !== undefined) {
    if (weightKg > 25) logistics -= 6;
    else if (weightKg > 10) logistics -= 3;
    else if (weightKg < 3) logistics += 2;
  }
  if (FRAGILE_RE.test(text)) logistics -= 4;
  if (HEAVY_CATEGORIES.has(assignment.category) && !dims) logistics -= 2;
  logistics = Math.max(0, Math.min(15, logistics));

  // ---- Advertising potential (10)
  let ad = 4;
  if (AD_FRIENDLY_RE.test(text)) ad += 3;
  if (['wall-panels', 'lighting', 'garden'].includes(assignment.category)) ad += 2; // before/after & glow content
  if (isBatteryHint) ad += 1; // flexible scenes
  ad = Math.max(0, Math.min(10, ad));

  // ---- Return risk (10, higher = lower risk)
  let ret = 8;
  if (FRAGILE_RE.test(text)) ret -= 3;
  if (assignment.category === 'wall-panels') ret -= 2; // installation & size risk
  if (['outdoor', 'outdoor-privacy'].includes(assignment.category)) ret -= 1;
  if (!dims && HEAVY_CATEGORIES.has(assignment.category)) ret -= 2;
  ret = Math.max(0, Math.min(10, ret));

  // ---- Bundle potential (5)
  let bundle = 1;
  if (BUNDLE_CATEGORIES.has(assignment.category)) bundle += 2;
  if (/set|pack/i.test(n.sourceProductName)) bundle += 2;
  bundle = Math.max(0, Math.min(5, bundle));

  // ---- Compliance complexity (5, higher = simpler)
  let compliance = 5;
  if (isElectricalHint) compliance -= 2;
  if (isBatteryHint) compliance -= 1;
  if (assignment.category === 'gadgets-smart-home') compliance -= 2;
  compliance = Math.max(0, Math.min(5, compliance));

  const total =
    margin + commercial + visual + logistics + ad + ret + bundle + compliance;

  return { marginPotential: margin, commercialPotential: commercial, visualAppeal: visual, logisticsEase: logistics, adPotential: ad, returnRisk: ret, bundlePotential: bundle, complianceComplexity: compliance, total };
}

function finalSpacesCount(a: CatalogAssignment): number {
  return a.spaces.length;
}
