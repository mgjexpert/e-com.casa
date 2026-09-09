// ============================================================
// E-com.casa — Importer (one-shot, idempotent)
// ------------------------------------------------------------
// Writes reproducibility artifacts to /data/catalog/*.json and
// upserts the selected demo catalogue into PostgreSQL via Prisma
// using stable SKUs/slugs (safe to run twice — no duplicates).
// Never deletes unrelated existing records.
// ============================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { RESEARCH_CONFIG } from './config';
import type { GeneratedProduct } from './product-generator';
import { CATEGORIES, SUBCATEGORIES, BUNDLES, RELATION_EXAMPLES } from './catalog-metadata';

export interface ImportSummary {
  productsUpserted: number;
  categoriesUpserted: number;
  researchRecordsUpdated: number;
  artifacts: string[];
  dbMode: 'postgres' | 'artifacts-only';
  note?: string;
}

function artifactPath(rel: string): string {
  return path.join(process.cwd(), rel);
}

function writeArtifact(rel: string, data: unknown): string {
  const p = artifactPath(rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return rel;
}

export async function importCatalogue(
  products: GeneratedProduct[],
  opts: { dryRun: boolean; runId?: string },
): Promise<ImportSummary> {
  const artifacts: string[] = [];

  // ---- Artifacts (always written — reproducibility layer) ----
  artifacts.push(writeArtifact(RESEARCH_CONFIG.output.productsFile, products));
  artifacts.push(
    writeArtifact(RESEARCH_CONFIG.output.catalogFile, {
      generatedAt: new Date().toISOString(),
      mode: 'demo',
      categories: CATEGORIES,
      subcategories: SUBCATEGORIES,
      note: 'Idempotent seed inputs for the E-com.casa demo catalogue. No secrets. No third-party copyrighted content.',
    }),
  );
  artifacts.push(writeArtifact(RESEARCH_CONFIG.output.relationsFile, { generatedAt: new Date().toISOString(), relations: RELATION_EXAMPLES }));
  artifacts.push(writeArtifact(RESEARCH_CONFIG.output.bundlesFile, { generatedAt: new Date().toISOString(), bundles: BUNDLES }));

  let productsUpserted = 0;
  let categoriesUpserted = 0;
  let researchRecordsUpdated = 0;
  let dbMode: ImportSummary['dbMode'] = 'artifacts-only';
  let note: string | undefined;

  if (opts.dryRun) {
    return { productsUpserted: 0, categoriesUpserted: 0, researchRecordsUpdated: 0, artifacts, dbMode, note: 'Dry run — no database writes.' };
  }

  // ---- Database upsert (Neon/PostgreSQL) ----
  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    dbMode = 'postgres';

    // Categories first
    for (const [i, c] of CATEGORIES.entries()) {
      await db.category.upsert({
        where: { type_slug: { type: c.type, slug: c.slug } },
        create: { slug: c.slug, name: c.name, type: c.type, image: c.image, subtitle: c.subtitle ?? null, sortOrder: i + 1 },
        update: { name: c.name, image: c.image, subtitle: c.subtitle ?? null },
      });
      categoriesUpserted++;
    }

    // Products (stable SKU identity)
    for (const [i, p] of products.entries()) {
      await db.product.upsert({
        where: { sku: p.sku },
        create: {
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
          variantsJson: JSON.stringify(p.variants),
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
        },
        update: {
          name: p.name,
          subtitle: p.subtitle,
          shortDescription: p.shortDescription,
          description: p.description,
          price: p.price,
          priceCents: p.priceCents,
          comparePrice: p.comparePrice,
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
          variantsJson: JSON.stringify(p.variants),
          electrical: p.electrical,
          battery: p.battery,
          requiresComplianceReview: p.requiresComplianceReview,
          sourceResearchId: p.sourceResearchId,
          sourceDomain: p.sourceDomain,
          sourceUrl: p.sourceUrl,
          sortOrder: i + 1,
        },
      });
      productsUpserted++;
    }

    // Mark linked research records IMPORTED
    if (opts.runId) {
      const res = await db.researchProduct.updateMany({
        where: { researchRunId: opts.runId, status: 'SELECTED' },
        data: { status: 'IMPORTED' },
      });
      researchRecordsUpdated = res.count;
      await db.researchRun.update({
        where: { id: opts.runId },
        data: { productsImported: productsUpserted, status: 'COMPLETED', completedAt: new Date() },
      });
    }
  } catch (e) {
    note = `Database unavailable (${(e as Error).message.slice(0, 140)}) — artifacts written, DB skipped. Run 'npm run db:seed' against Neon to import.`;
  } finally {
    await db.$disconnect();
  }

  return { productsUpserted, categoriesUpserted, researchRecordsUpdated, artifacts, dbMode, note };
}

/** Persist research records for the run (internal layer only). */
export async function persistResearchRecords(
  runId: string,
  sourceKeys: string[],
  records: Array<{ candidate: import('./normalizer').NormalizedCandidate; fingerprint: string; status: string; researchId: string; score?: import('./scoring').ScoreBreakdown; assignment?: import('./category-mapper').CatalogAssignment }>,
): Promise<number> {
  const db = new PrismaClient();
  let written = 0;
  try {
    // Sources
    for (const key of sourceKeys) {
      const { getSource } = await import('./sources');
      const s = getSource(key);
      if (!s) continue;
      await db.researchSource.upsert({
        where: { key: s.key },
        create: { key: s.key, name: s.name, domain: s.domain, homepage: s.homepage, tier: s.tier, enabled: s.enabled, priority: s.priority, lastRunAt: new Date() },
        update: { lastRunAt: new Date() },
      });
    }

    // Products (bounded — keep the internal research layer useful, not huge)
    for (const r of records) {
      await db.researchProduct.create({
        data: {
          researchRunId: runId,
          sourceUrl: r.candidate.sourceUrl,
          sourceProductId: r.candidate.sourceProductId,
          sourceProductName: r.candidate.sourceProductName,
          sourceBrand: r.candidate.sourceBrand,
          sourceCategory: r.candidate.sourceAttributes?.category ?? null,
          sourcePrice: r.candidate.sourcePrice !== undefined ? String(r.candidate.sourcePrice) : null,
          sourceCurrency: r.candidate.sourceCurrency,
          sourceAvailability: r.candidate.sourceAvailability,
          sourceSku: r.candidate.sourceSku,
          sourceGtin: r.candidate.sourceGtin,
          sourceDescription: r.candidate.sourceDescription?.slice(0, 1000),
          sourceMaterials: r.candidate.sourceMaterials,
          sourceColours: r.candidate.sourceColours,
          sourceDimensions: r.candidate.sourceDimensions,
          sourceWeight: r.candidate.sourceWeight,
          sourceAttributes: JSON.stringify(r.candidate.sourceAttributes ?? {}),
          sourceImageUrls: JSON.stringify(r.candidate.sourceImageUrls ?? []),
          sourceDataJson: JSON.stringify({ extractionMethod: r.candidate.extractionMethod, normalizedPriceEur: r.candidate.normalized.priceEur ?? null }),
          productFingerprint: r.fingerprint,
          researchScore: r.score?.total ?? null,
          scoreBreakdownJson: r.score ? JSON.stringify(r.score) : null,
          status: r.status,
        },
      });
      written++;
    }

    await db.researchRun.update({
      where: { id: runId },
      data: {
        productsDiscovered: records.length,
        pagesVisited: records.length, // refined by caller via run update below
      },
    });
  } catch {
    // Research layer is internal-only; never fail the run over it
  } finally {
    await db.$disconnect();
  }
  return written;
}
