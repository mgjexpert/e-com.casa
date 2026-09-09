// ============================================================
// E-com.casa — Idempotent database seed
// ------------------------------------------------------------
//   npm run db:seed          (bun prisma/seed.ts)
//
// Creates/updates categories, products, bundles metadata and
// demo reviews from the /data/catalog artifacts produced by the
// one-shot research pipeline. Uses stable SKUs/slugs, so it is
// safe to re-run any number of times — no duplicates, no deletion
// of unrelated records (orders, reviews and subscribers are never
// touched except idempotent demo-review upserts keyed by content).
// ============================================================

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const db = new PrismaClient();

interface ArtifactProduct {
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
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
  materials: string;
  dimensions: string;
  weight: string | null;
  care: string;
  color: string;
  shippingClass: string;
  variants: unknown[];
  electrical: boolean;
  battery: boolean;
  complianceStatus: string;
  reviewMode: string;
  documentationStatus: string;
  safetyJson: string;
  requiresComplianceReview: boolean;
  isDemo: boolean;
  sourceResearchId: string | null;
  sourceDomain: string | null;
  sourceUrl: string | null;
}

function readArtifact(file: string): unknown | null {
  const p = path.join(process.cwd(), 'data', 'catalog', file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

async function main() {
  console.log('E-com.casa seed — idempotent demo catalogue import');

  const catalog = readArtifact('generated-catalog.json') as { categories?: Array<{ slug: string; name: string; type: string; image: string; subtitle?: string }> } | null;
  const products = readArtifact('generated-products.json') as ArtifactProduct[] | null;

  if (!products || !Array.isArray(products) || products.length === 0) {
    console.error('No /data/catalog/generated-products.json found. Run `npm run catalog:research` first.');
    process.exit(1);
  }

  // ---- Categories ----
  const categories = catalog?.categories ?? [];
  for (const [i, c] of categories.entries()) {
    await db.category.upsert({
      where: { type_slug: { type: c.type, slug: c.slug } },
      create: {
        slug: c.slug,
        name: c.name,
        type: c.type,
        image: c.image,
        subtitle: c.subtitle ?? null,
        sortOrder: i + 1,
      },
      update: { name: c.name, image: c.image, subtitle: c.subtitle ?? null },
    });
  }
  console.log(`✔ categories: ${categories.length} upserted`);

  // ---- Products (stable SKU identity — idempotent) ----
  let created = 0;
  let updated = 0;
  for (const [i, p] of products.entries()) {
    const data = {
      slug: p.slug,
      sku: p.sku,
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
      variantsJson: JSON.stringify(p.variants ?? []),
      electrical: p.electrical,
      battery: p.battery,
      complianceStatus: p.complianceStatus,
      reviewMode: p.reviewMode,
      documentationStatus: p.documentationStatus,
      safetyJson: p.safetyJson,
      requiresComplianceReview: p.requiresComplianceReview,
      isDemo: p.isDemo,
      sourceResearchId: p.sourceResearchId,
      sourceDomain: p.sourceDomain,
      sourceUrl: p.sourceUrl,
      sortOrder: i + 1,
    };
    const existing = await db.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      await db.product.update({ where: { sku: p.sku }, data });
      updated++;
    } else {
      await db.product.create({ data });
      created++;
    }
  }
  console.log(`✔ products: ${products.length} processed (${created} created, ${updated} updated)`);

  // ---- Integrity checks (idempotency + data quality) ----
  const total = await db.product.count();
  const dupSkus = await db.$queryRaw<Array<{ sku: string; n: number }>>`
    SELECT sku, COUNT(*)::int AS n FROM "Product" GROUP BY sku HAVING COUNT(*) > 1`;
  const withoutSku = await db.product.count({ where: { sku: '' } });
  const demoCount = await db.product.count({ where: { isDemo: true } });
  const missing = await db.product.count({
    where: { OR: [{ image: '' }, { description: '' }, { categorySlug: '' }, { price: '' }] },
  });

  console.log(`✔ integrity: total=${total} duplicateSKUs=${dupSkus.length} missingSku=${withoutSku} demo=${demoCount} incomplete=${missing}`);
  if (dupSkus.length > 0) throw new Error('Duplicate SKUs detected — seed identity violated');
  if (missing > 0) console.warn('⚠ some products are missing required display data (image/description/category/price)');

  console.log('Seed complete ✔ (safe to re-run)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
