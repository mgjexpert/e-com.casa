// ============================================================
// E-com.casa — catalogue export (reproducibility artifact)
// ------------------------------------------------------------
// Dumps the full imported V2 catalogue to
// data/catalog/v2-catalogue-export.json so the identical
// catalogue can be replayed into another PostgreSQL (e.g. Neon)
// without re-crawling:  DATABASE_URL="<neon>" bun scripts/catalog-research-v2/replay-import.ts
// ============================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const products = await db.product.findMany({ orderBy: { sku: 'asc' } });
    const categories = await db.category.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] });
    const artifact = {
      exportedAt: new Date().toISOString(),
      engine: 'catalog-scraper-v2',
      note: 'Idempotent replay artifact — research-backed demo catalogue. No secrets, no third-party copyrighted content.',
      categories,
      products,
    };
    const p = path.join(process.cwd(), 'data/catalog/v2-catalogue-export.json');
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(artifact, null, 2), 'utf-8');
    console.log(`[export] ${products.length} products, ${categories.length} categories → ${path.relative(process.cwd(), p)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('[export] FATAL:', e);
  process.exit(1);
});
