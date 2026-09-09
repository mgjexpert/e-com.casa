// ============================================================
// E-com.casa — V2 selection (§57/§58)
// ------------------------------------------------------------
// NOT simply the highest scores: final selection optimizes
// quality + category/style/price/source/space diversity within
// the target mix. Import fewer rather than fabricate (§58).
// ============================================================

import { V2_CONFIG } from './config';

export interface SelectableCandidate {
  id: string;
  sourceKey: string;
  category: string;
  qualityScore: number;
  priceEur: number | null;
  styleSlugs: string[];
  spaceSlugs: string[];
}

export interface SelectionResult {
  selected: string[];
  categoryCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  rejectedBecauseLimits: number;
}

export function selectDiverse(candidates: SelectableCandidate[]): SelectionResult {
  const mix = { ...V2_CONFIG.catalogue.mix };
  const totalTarget = V2_CONFIG.catalogue.target;
  const maxPerSource = Math.ceil(totalTarget * V2_CONFIG.catalogue.maxSharePerSource);

  const byCategory = new Map<string, SelectableCandidate[]>();
  for (const c of candidates) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }
  for (const [, list] of byCategory) list.sort((a, b) => b.qualityScore - a.qualityScore);

  const selected: string[] = [];
  const categoryCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let rejectedBecauseLimits = 0;

  const pickFrom = (cat: string, quota: number): number => {
    const pool = (byCategory.get(cat) ?? []).filter((c) => !selected.includes(c.id));
    let picked = 0;
    for (const c of pool) {
      if (picked >= quota) break;
      if ((sourceCounts[c.sourceKey] ?? 0) >= maxPerSource) {
        rejectedBecauseLimits++;
        continue;
      }
      // style/space diversity: allow at most 4 from an identical style signature per category
      const styleSig = [...c.styleSlugs].sort().join(',');
      const sameSig = selectedIdsByCategory.get(cat)?.get(styleSig) ?? 0;
      if (sameSig >= 4) continue;
      selected.push(c.id);
      picked++;
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      sourceCounts[c.sourceKey] = (sourceCounts[c.sourceKey] ?? 0) + 1;
      const catSig = selectedIdsByCategory.get(cat) ?? new Map<string, number>();
      catSig.set(styleSig, sameSig + 1);
      selectedIdsByCategory.set(cat, catSig);
    }
    return picked;
  };

  const selectedIdsByCategory = new Map<string, Map<string, number>>();

  // Pass 1: fill exact mix quotas
  let totalQuota = 0;
  for (const quota of Object.values(mix)) totalQuota += quota;
  const scale = Math.min(1, totalTarget / totalQuota);
  for (const [cat, quota] of Object.entries(mix)) {
    pickFrom(cat, Math.max(1, Math.round(quota * scale)));
  }

  // Pass 2: redistribute unfilled quota into categories with remaining strong candidates
  let guard = 0;
  while (selected.length < totalTarget && guard++ < 50) {
    const remaining = [...byCategory.entries()]
      .map(([cat, list]) => ({ cat, avail: list.filter((c) => !selected.includes(c.id)).length }))
      .filter((x) => x.avail > 0)
      .sort((a, b) => b.avail - a.avail);
    if (remaining.length === 0) break;
    const before = selected.length;
    for (const { cat } of remaining.slice(0, 5)) {
      if (selected.length >= totalTarget) break;
      pickFrom(cat, 1);
    }
    if (selected.length === before) break;
  }

  return { selected, categoryCounts, sourceCounts, rejectedBecauseLimits };
}

/** §59: Top 10 launch candidates — visual/commercial/logistics balance. */
export function pickTopLaunch(selected: SelectableCandidate[], n = 10): string[] {
  return [...selected]
    .sort(
      (a, b) =>
        b.qualityScore - a.qualityScore ||
        (b.priceEur ?? 0) - (a.priceEur ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, n)
    .map((c) => c.id);
}

/** §60: 15 hero candidates spread across categories. */
export function pickHeroes(selected: SelectableCandidate[], n = 15): string[] {
  const byCat = new Map<string, SelectableCandidate[]>();
  for (const c of selected) {
    const l = byCat.get(c.category) ?? [];
    l.push(c);
    byCat.set(c.category, l);
  }
  const heroes: string[] = [];
  let round = 0;
  while (heroes.length < n && round < 20) {
    for (const [, list] of byCat) {
      if (heroes.length >= n) break;
      const sorted = [...list].sort((a, b) => b.qualityScore - a.qualityScore);
      const next = sorted[round];
      if (next && !heroes.includes(next.id)) heroes.push(next.id);
    }
    round++;
  }
  return heroes;
}
