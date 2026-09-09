// ============================================================
// E-com.casa — replay import (Neon population without re-crawl)
// ------------------------------------------------------------
// Upserts the exported V2 catalogue (data/catalog/v2-catalogue-
// export.json) into whatever DATABASE_URL points at — e.g. the
// Neon production database. Idempotent: stable SKU identity,
// safe to run any number of times.
//
//   DATABASE_URL="<neon-pooled>" bun scripts/catalog-research-v2/replay-import.ts
// ============================================================

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

interface ExportedCategory {
  id: string;
  slug: string;
  name: string;
  type: string;
  image?: string | null;
  subtitle?: string | null;
  sortOrder: number;
}

interface ExportedProduct {
  slug: string;
  sku: string;
  name: string;
  subtitle: string | null;
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
  rating: number;
  reviewCount: number;
  stock: number;
  availability: string;
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  color: string | null;
  shippingClass: string;
  variantsJson: string;
  electrical: boolean;
  battery: boolean;
  complianceStatus: string;
  reviewMode: string;
  documentationStatus: string;
  isDemo: boolean;
  sourceResearchId: string | null;
  sourceDomain: string | null;
  sourceUrl: string | null;
}

async function main(): Promise<void> {
  const file = path.join(process.cwd(), 'data/catalog/v2-catalogue-export.json');
  if (!existsSync(file)) {
    console.error('[replay] missing data/catalog/v2-catalogue-export.json — run export-catalogue.ts first');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, 'utf-8')) as { categories: ExportedCategory[]; products: ExportedProduct[] };
  console.log(`[replay] importing ${data.products.length} products + ${data.categories.length} categories into ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@')}`);

  const db = new PrismaClient();
  let cats = 0;
  let prods = 0;
  try {
    for (const [i, c] of data.categories.entries()) {
      await db.category.upsert({
        where: { type_slug: { type: c.type, slug: c.slug } },
        create: { slug: c.slug, name: c.name, type: c.type, image: c.image ?? null, subtitle: c.subtitle ?? null, sortOrder: c.sortOrder || i + 1 },
        update: { name: c.name, image: c.image ?? null, subtitle: c.subtitle ?? null },
      });
      cats++;
    }

    for (const [i, p] of data.products.entries()) {
      const row = {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
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
        rating: p.rating,
        reviewCount: p.reviewCount,
        stock: p.stock,
        availability: p.availability,
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
        complianceStatus: p.complianceStatus || 'DEMO',
        reviewMode: p.reviewMode || 'demo',
        documentationStatus: p.documentationStatus || 'DEMO',
        isDemo: true,
        sourceResearchId: p.sourceResearchId,
        sourceDomain: p.sourceDomain,
        sourceUrl: p.sourceUrl,
        sortOrder: i + 1,
      };
      await db.product.upsert({ where: { sku: p.sku }, create: { sku: p.sku, ...row }, update: row });
      prods++;
    }

    // retire legacy non-research-backed products in the target database (§82)
    const legacy = await db.product.findMany({ where: { sourceResearchId: null, sku: { notIn: data.products.map((p) => p.sku) } }, select: { id: true, slug: true } });
    if (legacy.length > 0 && data.products.length >= 100) {
      const slugs = legacy.map((l) => l.slug);
      await db.review.deleteMany({ where: { productSlug: { in: slugs } } });
      const del = await db.product.deleteMany({ where: { id: { in: legacy.map((l) => l.id) } } });
      console.log(`[replay] retired ${del.count} legacy archetype products in target database`);
    }

    console.log(`[replay] done: ${cats} categories, ${prods} products upserted — catalogue is live`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('[replay] FATAL:', e);
  process.exit(1);
});
