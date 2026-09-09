// ============================================================
// E-com.casa — retire legacy (pre-V2) catalogue products (§82/§89)
// ------------------------------------------------------------
// Once the V2 research-backed catalogue reaches the acceptable
// minimum (100), archetype-generated V1 products are retired so
// the primary catalogue is unambiguously research-backed.
// The archetype fixtures remain available as the demo-adapter
// fallback (data/catalog/*.json) — they are only removed from
// the live database catalogue.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { V2_CONFIG } from './config';

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const v2Runs = await db.researchRun.findMany({ where: { engine: 'v2' }, select: { id: true } });
    const v2RunIds = v2Runs.map((r) => r.id);

    const v2Research = await db.researchProduct.findMany({
      where: { researchRunId: { in: v2RunIds } },
      select: { id: true },
    });
    const v2ResearchIds = new Set(v2Research.map((r) => r.id));

    const v2Backed = await db.product.count({ where: { sourceResearchId: { in: [...v2ResearchIds] } } });
    console.log(`[retire-legacy] V2-backed products in catalogue: ${v2Backed}`);

    if (v2Backed < V2_CONFIG.catalogue.acceptableMinimum) {
      console.log(`[retire-legacy] below ${V2_CONFIG.catalogue.acceptableMinimum} — keeping legacy products (§58: fewer, never fabricate)`);
      return;
    }

    const legacy = await db.product.findMany({
      where: { sourceResearchId: null },
      select: { id: true, slug: true, name: true },
    });
    const legacyWithV1Research = await db.product.findMany({
      where: { sourceResearchId: { not: null, notIn: [...v2ResearchIds] } },
      select: { id: true, slug: true, name: true },
    });
    const toRetire = [...legacy, ...legacyWithV1Research];
    console.log(`[retire-legacy] retiring ${toRetire.length} legacy products (archetype + v1-snippet-backed)`);

    if (toRetire.length > 0) {
      const slugs = toRetire.map((p) => p.slug);
      const delReviews = await db.review.deleteMany({ where: { productSlug: { in: slugs } } });
      const del = await db.product.deleteMany({ where: { id: { in: toRetire.map((p) => p.id) } } });
      console.log(`[retire-legacy] deleted ${del.count} products, ${delReviews.count} orphaned demo reviews`);
    }

    const total = await db.product.count();
    const v2Final = await db.product.count({ where: { sourceResearchId: { in: [...v2ResearchIds] } } });
    console.log(`[retire-legacy] catalogue now: ${total} products — ${v2Final} V2 research-backed (100%)`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('[retire-legacy] FATAL:', e);
  process.exit(1);
});
