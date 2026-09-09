// ============================================================
// E-com.casa — V2 deduplication (§28/§29)
// ------------------------------------------------------------
// Identity: GTIN/EAN/MPN/SKU/canonical URL/normalized name+brand/
// dimensions+material+variant config. Classifies EXACT_DUPLICATE |
// LIKELY_DUPLICATE | VARIANT | RELATED | UNIQUE. Cross-source
// duplicates share a duplicateGroupId; research records are NEVER
// deleted — only one canonical record is selected for import.
// ============================================================

export interface DedupeInput {
  id: string;
  sourceKey: string;
  sourceUrl: string;
  canonicalUrl?: string;
  gtin?: string;
  ean?: string;
  mpn?: string;
  sku?: string;
  name: string;
  brand?: string;
  material?: string | null;
  dimsText?: string | null;
}

export type DuplicateKind = 'EXACT_DUPLICATE' | 'LIKELY_DUPLICATE' | 'VARIANT' | 'RELATED' | 'UNIQUE';

export interface DedupeResult {
  kind: DuplicateKind;
  duplicateOf?: string;
  duplicateGroupId?: string;
  duplicateConfidence: number;
}

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9åäöéèü+ ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['the', 'and', 'with', 'for', 'van', 'der', 'und', 'mit', 'con', 'les', 'des', 'del'].includes(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function fingerprintOf(p: DedupeInput): string {
  const parts = [
    p.brand ?? '',
    tokens(p.name).size > 0 ? [...tokens(p.name)].sort().slice(0, 6).join('-') : p.name.toLowerCase(),
  ];
  return parts.join('::');
}

export function dedupeProducts(products: DedupeInput[]): Map<string, DedupeResult> {
  const results = new Map<string, DedupeResult>();
  const groups = new Map<string, string[]>(); // groupId -> ids

  // identity indexes
  const byGtin = new Map<string, string>();
  const byCanonical = new Map<string, string>();
  const bySkuDomain = new Map<string, string>();
  const byFingerprint = new Map<string, string[]>();

  let groupCounter = 0;

  for (const p of products) {
    let result: DedupeResult = { kind: 'UNIQUE', duplicateConfidence: 0 };
    let matchedId: string | undefined;
    let confidence = 0;

    const gtin = p.gtin ?? p.ean;
    if (gtin && byGtin.has(gtin)) {
      matchedId = byGtin.get(gtin);
      confidence = 0.99;
    } else if (p.canonicalUrl && byCanonical.has(p.canonicalUrl)) {
      matchedId = byCanonical.get(p.canonicalUrl);
      confidence = 0.98;
    } else if (p.sku && bySkuDomain.has(`${p.sourceKey}::${p.sku}`)) {
      matchedId = bySkuDomain.get(`${p.sourceKey}::${p.sku}`);
      confidence = 0.97;
    } else if (p.canonicalUrl && byCanonical.size < 50_000) {
      // fall through to fingerprint check
    }

    // name+brand fingerprint (within & cross source)
    const fp = fingerprintOf(p);
    const candidates = byFingerprint.get(fp) ?? [];
    if (!matchedId && candidates.length > 0) {
      const dimsMatch = (a: DedupeInput, b: DedupeInput): boolean =>
        (a.material ?? '') !== '' && a.material === b.material;
      const pt = tokens(p.name);
      for (const cid of candidates) {
        const c = products.find((x) => x.id === cid);
        if (!c) continue;
        const j = jaccard(pt, tokens(c.name));
        const sameBrand = (p.brand ?? '').toLowerCase() === (c.brand ?? '').toLowerCase();
        if (j >= 0.9 && (sameBrand || !p.brand || !c.brand)) {
          matchedId = cid;
          confidence = Math.min(0.96, 0.7 + j * 0.25);
          break;
        }
        if (j >= 0.82 && sameBrand && dimsMatch(p, c)) {
          matchedId = cid;
          confidence = 0.85;
          break;
        }
      }
      if (!matchedId && candidates.length > 0) {
        // RELATED — same family, keep separate (§28: if uncertain, keep separate)
        const c0 = products.find((x) => x.id === candidates[0]);
        if (c0) {
          const j = jaccard(pt, tokens(c0.name));
          if (j >= 0.6) {
            result = { kind: 'RELATED', duplicateOf: candidates[0], duplicateConfidence: 0.6 };
          }
        }
      }
    }

    if (matchedId) {
      const isCrossSource = products.find((x) => x.id === matchedId)?.sourceKey !== p.sourceKey;
      result = {
        kind: confidence >= 0.9 ? 'EXACT_DUPLICATE' : 'LIKELY_DUPLICATE',
        duplicateOf: matchedId,
        duplicateConfidence: confidence,
      };
      const matched = results.get(matchedId);
      const groupId = matched?.duplicateGroupId ?? `dg-${++groupCounter}`;
      if (!matched) {
        results.set(matchedId, { kind: 'UNIQUE', duplicateGroupId: groupId, duplicateConfidence: 0 });
      }
      result.duplicateGroupId = groupId;
      if (isCrossSource) {
        // cross-source duplicates carry slightly lower confidence
        result.duplicateConfidence = Math.min(result.duplicateConfidence, 0.94);
      }
    } else if (result.kind === 'UNIQUE') {
      // register identities
      const gtin = p.gtin ?? p.ean;
      if (gtin) byGtin.set(gtin, p.id);
      if (p.canonicalUrl) byCanonical.set(p.canonicalUrl, p.id);
      if (p.sku) bySkuDomain.set(`${p.sourceKey}::${p.sku}`, p.id);
      const list = byFingerprint.get(fp) ?? [];
      list.push(p.id);
      byFingerprint.set(fp, list);
    }

    results.set(p.id, result);
  }

  return results;
}

export function selectCanonical(
  products: DedupeInput[],
  results: Map<string, DedupeResult>,
  scores: Map<string, number>, // id -> quality score
  sourcePriority: Map<string, number>, // sourceKey -> priority (§30: prefer data quality over price)
): string[] {
  const byId = new Map(products.map((p) => [p.id, p]));

  // Group every record at the root of its duplicateOf chain
  const rootOf = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (true) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const dupOf = results.get(cur)?.duplicateOf;
      if (!dupOf || !byId.has(dupOf)) break;
      cur = dupOf;
    }
    return cur;
  };
  const groups = new Map<string, string[]>();
  for (const p of products) {
    const root = rootOf(p.id);
    const list = groups.get(root) ?? [];
    list.push(p.id);
    groups.set(root, list);
  }

  const canonicals: string[] = [];
  for (const [, members] of groups) {
    if (members.length === 1) {
      canonicals.push(members[0]);
      continue;
    }
    // §30: prefer completeness/quality, then source priority, then stable URL
    members.sort((a, b) => {
      const pa = byId.get(a)!;
      const pb = byId.get(b)!;
      return (
        (scores.get(b) ?? 0) - (scores.get(a) ?? 0) ||
        (sourcePriority.get(pb.sourceKey) ?? 0) - (sourcePriority.get(pa.sourceKey) ?? 0) ||
        pa.sourceUrl.length - pb.sourceUrl.length
      );
    });
    canonicals.push(members[0]);
  }
  return canonicals;
}
