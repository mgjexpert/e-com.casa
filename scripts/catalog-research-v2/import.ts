// ============================================================
// E-com.casa — V2 importer (§74/§75/§76/§77, §82)
// ------------------------------------------------------------
// Imports selected research-backed demo products into PostgreSQL
// (Neon via DATABASE_URL) with Prisma. Idempotent: stable SKU map
// keyed by sourceUrl + upserts. Archetype-only synthetic products
// are retired once enough real research-backed products exist
// (§82) — the storefront's primary catalogue is research-backed.
// Never imports third-party review text (§36) and never hotlinks
// source imagery (§78).
// ============================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { V2_CONFIG, CATEGORY_PREFIX } from './config';

export interface DemoProductForImport {
  researchId: string;
  sku: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  shortDescription: string;
  description: string;
  price: string;
  priceCents: number;
  comparePrice: string | null;
  currency: string;
  categorySlug: string;
  subcategorySlugs: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs: string;
  image: string;
  hoverImage: string | null;
  gallery: string;
  imageStatus: string;
  badge: string | null;
  featured: boolean;
  isBestSeller: boolean;
  isNew: boolean;
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  color: string | null;
  shippingClass: string;
  variantsJson: string;
  electrical: boolean;
  battery: boolean;
  marketObservedPrice: number | null;
  marketObservedCurrency: string | null;
  sourceDomain: string;
  sourceUrl: string;
  sourceKey: string;
}

export interface ImportOutcome {
  upserted: number;
  retired: number;
  retiredReviews: number;
  skuMapFile: string;
  dbConnected: boolean;
  note?: string;
}

interface SkuMap {
  version: 2;
  bySourceUrl: Record<string, { sku: string; slug: string }>;
  counters: Record<string, number>;
}

function loadSkuMap(): SkuMap {
  const p = path.join(process.cwd(), V2_CONFIG.output.skuMapFile);
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as SkuMap;
    } catch {
      /* fresh */
    }
  }
  return { version: 2, bySourceUrl: {}, counters: {} };
}

function saveSkuMap(map: SkuMap): void {
  const p = path.join(process.cwd(), V2_CONFIG.output.skuMapFile);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(map, null, 2), 'utf-8');
}

/** Assign stable EC-<CATEGORY>-<###> SKUs (§76), continuing after existing DB SKUs. */
async function assignSkus(db: PrismaClient, products: DemoProductForImport[]): Promise<void> {
  const map = loadSkuMap();

  // continue numbering beyond any existing SKU in each category prefix
  const existing = await db.product.findMany({ where: { sku: { startsWith: 'EC-' } }, select: { sku: true } });
  for (const e of existing) {
    const m = e.sku.match(/^EC-([A-Z]+)-(\d+)$/);
    if (m) {
      const [, prefix, num] = m;
      map.counters[prefix] = Math.max(map.counters[prefix] ?? 0, parseInt(num, 10));
    }
  }

  for (const p of products) {
    const key = p.sourceUrl;
    if (!map.bySourceUrl[key]) {
      const prefix = CATEGORY_PREFIX[p.categorySlug] ?? 'GEN';
      map.counters[prefix] = (map.counters[prefix] ?? 0) + 1;
      const sku = `EC-${prefix}-${String(map.counters[prefix]).padStart(3, '0')}`;
      map.bySourceUrl[key] = { sku, slug: p.slug };
    }
    p.sku = map.bySourceUrl[key].sku;
  }
  saveSkuMap(map);
}

export async function importSelected(
  products: DemoProductForImport[],
  opts: { dryRun: boolean; retireSyntheticOnly: boolean },
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { upserted: 0, retired: 0, retiredReviews: 0, skuMapFile: V2_CONFIG.output.skuMapFile, dbConnected: false };

  if (opts.dryRun) {
    outcome.note = 'Dry run — no database writes. Research tables may still record run metadata.';
    return outcome;
  }

  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    outcome.dbConnected = true;

    // 1) Assign stable SKUs (idempotent across runs)
    await assignSkus(db, products);

    // 2) Upsert products
    for (const [i, p] of products.entries()) {
      const data = {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle ?? null,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        priceCents: p.priceCents,
        comparePrice: p.comparePrice,
        currency: p.currency,
        categorySlug: p.categorySlug,
        subcategorySlugs: p.subcategorySlugs,
        spaceSlugs: p.spaceSlugs,
        styleSlugs: p.styleSlugs,
        collectionSlugs: p.collectionSlugs,
        image: p.image,
        hoverImage: p.hoverImage,
        gallery: p.gallery,
        imageStatus: p.imageStatus,
        badge: p.badge,
        rating: 4.5,
        reviewCount: 0,
        stock: 50,
        availability: 'inStock',
        isBestSeller: p.isBestSeller,
        isNew: p.isNew,
        featured: p.featured,
        materials: p.materials,
        dimensions: p.dimensions,
        weight: p.weight,
        care: p.care,
        color: p.color,
        shippingClass: p.shippingClass,
        variantsJson: p.variantsJson,
        electrical: p.electrical,
        battery: p.battery,
        complianceStatus: 'DEMO',
        reviewMode: 'demo',
        documentationStatus: 'DEMO',
        safetyJson: null,
        requiresComplianceReview: false,
        isDemo: true,
        sourceResearchId: p.researchId,
        sourceDomain: p.sourceDomain,
        sourceUrl: p.sourceUrl,
        sortOrder: i + 1,
      };
      await db.product.upsert({
        where: { sku: p.sku },
        create: { sku: p.sku, ...data },
        update: data,
      });
      outcome.upserted++;
    }

    // 3) Retire archetype-only synthetic products once real research-backed catalogue is in place (§82)
    //    Only products WITHOUT research provenance are retired — research-backed products
    //    from earlier runs are preserved and stay part of the primary catalogue.
    if (opts.retireSyntheticOnly && products.length >= V2_CONFIG.catalogue.acceptableMinimum) {
      const keepSkus = new Set(products.map((p) => p.sku));
      const all = await db.product.findMany({
        where: { sku: { notIn: [...keepSkus] }, sourceResearchId: null },
        select: { id: true, sku: true, slug: true },
      });
      if (all.length > 0) {
        const slugs = all.map((a) => a.slug);
        const delReviews = await db.review.deleteMany({ where: { productSlug: { in: slugs } } });
        outcome.retiredReviews = delReviews.count;
        const del = await db.product.deleteMany({ where: { id: { in: all.map((a) => a.id) } } });
        outcome.retired = del.count;
      }
    }

    // 4) Mark research records imported
    const researchIds = products.map((p) => p.researchId);
    await db.researchProduct.updateMany({ where: { id: { in: researchIds } }, data: { status: 'IMPORTED' } });
  } catch (e) {
    outcome.note = `Database error: ${(e as Error).message.slice(0, 200)}`;
  } finally {
    await db.$disconnect();
  }
  return outcome;
}
