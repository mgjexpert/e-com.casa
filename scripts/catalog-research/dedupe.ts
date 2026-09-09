// ============================================================
// E-com.casa — Duplicate detection & product families
// ------------------------------------------------------------
// Fingerprints + fuzzy matching classify candidates as
// EXACT_DUPLICATE / NEAR_DUPLICATE / VARIANT / RELATED / UNIQUE.
// Genuine variants (sizes, sets, colours) are KEPT as families —
// they are not removed merely for having similar names.
// ============================================================

import type { NormalizedCandidate } from './normalizer';

export type DuplicateClass = 'EXACT_DUPLICATE' | 'NEAR_DUPLICATE' | 'VARIANT' | 'RELATED' | 'UNIQUE';

export interface DedupeResult {
  candidate: NormalizedCandidate;
  class: DuplicateClass;
  duplicateOf?: string; // fingerprint of the representative
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['the', 'and', 'with', 'for', 'set', 'of', 'cm', 'mm'].includes(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/** Family detection: strip variant markers before comparing. */
function familyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/set of \d+|pack of \d+|\b\d+\s?(pack|pcs|pieces)\b/g, '')
    .replace(/\b\d{2,4}\s?(cm|mm|x)\b/g, '')
    .replace(/\b(small|medium|large|xl|mini)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const VARIANT_RE = /set of \d+|pack of \d+|\b\d+\s?(pack|pcs|pieces)\b|\b(small|medium|large|xl)\b|\b\d{2,4}\s?cm\b/i;

export function dedupe(candidates: NormalizedCandidate[]): DedupeResult[] {
  const results: DedupeResult[] = [];
  const seen = new Map<string, NormalizedCandidate>(); // fingerprint → representative
  const families = new Map<string, NormalizedCandidate[]>(); // familyKey → members

  for (const c of candidates) {
    const fp = `${c.normalized.nameClean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}|${Math.round(c.normalized.priceEur ?? 0)}`;
    const nameTokens = tokenSet(c.normalized.nameClean);
    const fk = familyKey(c.normalized.nameClean);

    // EXACT: same fingerprint (name + rounded price)
    const exact = seen.get(fp);
    if (exact) {
      results.push({ candidate: c, class: 'EXACT_DUPLICATE', duplicateOf: fp });
      continue;
    }

    // Near-duplicate / variant scan within the same family
    const family = families.get(fk) ?? [];
    let classified: DuplicateClass = 'UNIQUE';
    let duplicateOf: string | undefined;

    for (const member of family) {
      const sim = jaccard(nameTokens, tokenSet(member.normalized.nameClean));
      if (sim >= 0.82) {
        const isVariant = VARIANT_RE.test(c.normalized.nameClean) || VARIANT_RE.test(member.normalized.nameClean);
        const priceClose =
          c.normalized.priceEur !== undefined &&
          member.normalized.priceEur !== undefined &&
          Math.abs(c.normalized.priceEur - member.normalized.priceEur) / Math.max(member.normalized.priceEur, 1) < 0.2;
        if (isVariant) {
          classified = 'VARIANT'; // keep — genuine family member
          break;
        } else if (priceClose && sim >= 0.9) {
          classified = 'EXACT_DUPLICATE';
          duplicateOf = `${member.normalized.nameClean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}|${Math.round(member.normalized.priceEur ?? 0)}`;
          break;
        } else if (sim >= 0.9) {
          classified = 'NEAR_DUPLICATE';
          duplicateOf = `${member.normalized.nameClean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}|${Math.round(member.normalized.priceEur ?? 0)}`;
          break;
        } else {
          classified = 'RELATED'; // keep — related but distinct
        }
      }
    }

    // Cross-source near-duplicate scan (same generic product at multiple retailers)
    if (classified === 'UNIQUE') {
      for (const r of results) {
        if (r.class !== 'UNIQUE' && r.class !== 'VARIANT' && r.class !== 'RELATED') continue;
        if (r.candidate.sourceKey === c.sourceKey) continue;
        const sim = jaccard(nameTokens, tokenSet(r.candidate.normalized.nameClean));
        if (sim >= 0.93) {
          const dimsClose =
            !c.normalized.dims || !r.candidate.normalized.dims
              ? true
              : Math.abs((c.normalized.dims.length ?? 0) - (r.candidate.normalized.dims.length ?? 0)) < 3;
          if (dimsClose) {
            classified = 'NEAR_DUPLICATE';
            duplicateOf = r.candidate.normalized.nameClean.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            break;
          }
        }
      }
    }

    results.push({ candidate: c, class: classified, duplicateOf });
    if (classified !== 'EXACT_DUPLICATE') {
      seen.set(fp, c);
      family.push(c);
      families.set(fk, family);
    }
  }

  return results;
}
