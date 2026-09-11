#!/usr/bin/env node
/**
 * E-com.casa — BigBuy public-index research importer
 *
 * Imports product facts already visible in public search-engine indexes.
 * It DOES NOT crawl BigBuy category/product pages and therefore does not
 * circumvent BigBuy robots.txt restrictions. No prices, stock quantities,
 * media rights, compliance approvals or saleability are invented.
 *
 * Required: DATABASE_URL
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DATA_FILE = new URL('../../data/catalog/bigbuy-public-index-seed.json', import.meta.url);

function boundedJson(value, max = 24_000) {
  const text = JSON.stringify(value);
  return text.length <= max ? text : JSON.stringify({ truncated: true, preview: text.slice(0, max - 100) });
}

function completeness(p) {
  const checks = [
    p.sourceProductId,
    p.sourceUrl,
    p.sourceProductName,
    p.sourceBrand,
    p.sourceCategory,
    p.sourceSubcategory,
    p.sourceDescription,
    p.sourceMaterials || p.sourceColours,
    p.sourceDimensions || p.sourceWeight,
    p.attributes && Object.keys(p.attributes).length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

async function ensureTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "ResearchSource" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "homepage" TEXT NOT NULL,
      "tier" INTEGER NOT NULL DEFAULT 2,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "priority" INTEGER NOT NULL DEFAULT 50,
      "lastRunAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchRun" (
      "id" TEXT PRIMARY KEY,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'RUNNING',
      "mode" TEXT NOT NULL DEFAULT 'import',
      "engine" TEXT NOT NULL DEFAULT 'v2',
      "sourceCount" INTEGER NOT NULL DEFAULT 0,
      "sourcesAttempted" INTEGER NOT NULL DEFAULT 0,
      "sourcesSuccessful" INTEGER NOT NULL DEFAULT 0,
      "pagesVisited" INTEGER NOT NULL DEFAULT 0,
      "productPagesVisited" INTEGER NOT NULL DEFAULT 0,
      "productsDiscovered" INTEGER NOT NULL DEFAULT 0,
      "productsParsed" INTEGER NOT NULL DEFAULT 0,
      "productsNormalized" INTEGER NOT NULL DEFAULT 0,
      "productsRejected" INTEGER NOT NULL DEFAULT 0,
      "productsImported" INTEGER NOT NULL DEFAULT 0,
      "errorsJson" TEXT NOT NULL DEFAULT '[]',
      "configJson" TEXT,
      "notes" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "ResearchProduct" (
      "id" TEXT PRIMARY KEY,
      "researchRunId" TEXT NOT NULL,
      "sourceId" TEXT,
      "pageId" TEXT,
      "sourceUrl" TEXT NOT NULL,
      "canonicalUrl" TEXT,
      "sourceProductId" TEXT,
      "sourceProductName" TEXT NOT NULL,
      "sourceBrand" TEXT,
      "sourceCategory" TEXT,
      "sourceSubcategory" TEXT,
      "sourceCollection" TEXT,
      "sourcePrice" TEXT,
      "sourceCurrency" TEXT,
      "sourceSalePrice" TEXT,
      "rawPriceText" TEXT,
      "observedAt" TIMESTAMP(3),
      "sourceAvailability" TEXT,
      "sourceSku" TEXT,
      "sourceMpn" TEXT,
      "sourceEan" TEXT,
      "sourceGtin" TEXT,
      "sourceDescription" TEXT,
      "sourceMaterials" TEXT,
      "sourceColours" TEXT,
      "sourceDimensions" TEXT,
      "sourceWeight" TEXT,
      "sourceAttributes" TEXT,
      "sourceImageUrls" TEXT,
      "sourceDataJson" TEXT,
      "productFingerprint" TEXT,
      "researchScore" INTEGER,
      "scoreBreakdownJson" TEXT,
      "extractionMethod" TEXT,
      "extractionConfidence" INTEGER,
      "completenessScore" INTEGER,
      "qualityScore" INTEGER,
      "imageCount" INTEGER NOT NULL DEFAULT 0,
      "variantCount" INTEGER NOT NULL DEFAULT 0,
      "duplicateGroupId" TEXT,
      "duplicateConfidence" DOUBLE PRECISION,
      "duplicateKind" TEXT,
      "selectionRank" INTEGER,
      "generatedSku" TEXT,
      "countryFitJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_researchRunId_idx" ON "ResearchProduct"("researchRunId")`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_status_idx" ON "ResearchProduct"("status")`,
    `CREATE INDEX IF NOT EXISTS "ResearchProduct_productFingerprint_idx" ON "ResearchProduct"("productFingerprint")`
  ];
  for (const sql of statements) await db.$executeRawUnsafe(sql);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const products = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  if (!Array.isArray(products) || products.length === 0) throw new Error('Seed dataset is empty');

  await ensureTables();

  const source = await db.researchSource.upsert({
    where: { key: 'bigbuy-public-index' },
    update: { lastRunAt: new Date(), enabled: true },
    create: {
      key: 'bigbuy-public-index',
      name: 'BigBuy public indexed catalogue',
      domain: 'bigbuy.eu',
      homepage: 'https://www.bigbuy.eu/pt/tiendab2b.html',
      tier: 1,
      enabled: true,
      priority: 90,
      lastRunAt: new Date(),
    },
  });

  const run = await db.researchRun.create({
    data: {
      status: 'RUNNING',
      mode: 'import',
      engine: 'public-index-v1',
      sourceCount: 1,
      sourcesAttempted: 1,
      configJson: boundedJson({ roots: ['Casa e cozinha', 'Iluminação'], provenance: 'public search index', count: products.length }),
      notes: 'Seeded from public search-indexed BigBuy product facts; no direct category crawling and no prices.',
    },
  });

  let created = 0;
  let updated = 0;
  let casa = 0;
  let lighting = 0;

  for (const p of products) {
    if (!p.sourceProductId || !p.sourceUrl || !p.sourceProductName) continue;
    const now = new Date();
    const score = p.electrical ? 60 : 78;
    const quality = p.electrical ? 58 : 76;
    const fingerprint = crypto.createHash('sha256').update(`bigbuy:${p.sourceProductId}`).digest('hex');
    const sourceData = {
      provenance: 'public-search-index',
      priceObserved: false,
      exactStockObserved: false,
      mediaRightsConfirmed: false,
      electrical: Boolean(p.electrical),
      requiresComplianceReview: Boolean(p.electrical),
      attributes: p.attributes || {},
    };

    const existing = await db.researchProduct.findFirst({
      where: { sourceId: source.id, sourceProductId: String(p.sourceProductId) },
      select: { id: true },
    });

    const data = {
      researchRunId: run.id,
      sourceId: source.id,
      sourceUrl: p.sourceUrl,
      canonicalUrl: p.sourceUrl,
      sourceProductId: String(p.sourceProductId),
      sourceProductName: p.sourceProductName,
      sourceBrand: p.sourceBrand || null,
      sourceCategory: p.sourceCategory || null,
      sourceSubcategory: p.sourceSubcategory || null,
      sourcePrice: null,
      sourceCurrency: null,
      sourceSalePrice: null,
      rawPriceText: null,
      observedAt: now,
      sourceAvailability: p.sourceAvailability || null,
      sourceSku: null,
      sourceMpn: null,
      sourceEan: null,
      sourceGtin: null,
      sourceDescription: p.sourceDescription || null,
      sourceMaterials: p.sourceMaterials || null,
      sourceColours: p.sourceColours || null,
      sourceDimensions: p.sourceDimensions || null,
      sourceWeight: p.sourceWeight || null,
      sourceAttributes: boundedJson(p.attributes || {}),
      sourceImageUrls: '[]',
      sourceDataJson: boundedJson(sourceData),
      productFingerprint: fingerprint,
      researchScore: score,
      scoreBreakdownJson: boundedJson({ identity: 20, content: 20, attributes: 20, commercial: 0, compliance: p.electrical ? 0 : 18 }),
      extractionMethod: 'search-index-public',
      extractionConfidence: 82,
      completenessScore: completeness(p),
      qualityScore: quality,
      imageCount: 0,
      variantCount: 0,
      duplicateKind: 'UNIQUE',
      countryFitJson: boundedJson({ PT: 'HIGH', ES: 'HIGH', FR: 'HIGH', DE: 'HIGH', IT: 'HIGH', NL: 'HIGH' }),
      status: 'NORMALIZED',
      updatedAt: now,
    };

    if (existing) {
      await db.researchProduct.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.researchProduct.create({ data });
      created++;
    }

    if (p.sourceCategory === 'Iluminação') lighting++;
    else if (p.sourceCategory === 'Casa e cozinha') casa++;
  }

  await db.researchRun.update({
    where: { id: run.id },
    data: {
      completedAt: new Date(),
      status: 'COMPLETED',
      sourcesSuccessful: 1,
      productsDiscovered: created + updated,
      productsParsed: created + updated,
      productsNormalized: created + updated,
      productsImported: created + updated,
      notes: `Public-index starter catalogue imported. Casa=${casa}, Iluminacao=${lighting}, created=${created}, updated=${updated}.`,
    },
  });

  console.log(`BigBuy public-index import complete: total=${created + updated} casa=${casa} iluminacao=${lighting} created=${created} updated=${updated}`);
  console.log('No wholesale prices, exact stock quantities or media rights were inferred. Products remain research/staging only.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
