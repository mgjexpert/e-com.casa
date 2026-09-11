#!/usr/bin/env node
/**
 * E-com.casa — promote BigBuy public-index research rows into Product.
 *
 * This is a VISIBILITY bridge, not a saleability approval. It lets the
 * storefront render researched BigBuy items while price, exact stock, media
 * rights and compliance documentation are still pending. Checkout remains
 * locked by the central saleability gate.
 *
 * Required: DATABASE_URL
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const PLACEHOLDER_IMAGE = '/images/product-awaiting-media.svg';

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function categoryFor(row) {
  if (row.sourceCategory === 'Iluminação') return 'lighting';
  const sub = String(row.sourceSubcategory || '').toLowerCase();
  if (/têxteis|texteis|decora/.test(sub)) return 'decoration';
  if (/móveis|moveis/.test(sub)) return 'interior';
  return 'interior';
}

function safetyFor(row, electrical) {
  return JSON.stringify({
    productIdentifier: `BIGBUY-${row.sourceProductId}`,
    manufacturerName: null,
    manufacturerAddress: null,
    manufacturerEmail: null,
    euResponsiblePerson: null,
    countryOfOrigin: null,
    warnings: [],
    safetyInstructions: [],
    ceMarking: electrical ? '[TO BE CONFIRMED]' : 'NOT_CONFIRMED',
    weee: electrical ? '[TO BE CONFIRMED]' : 'NOT_APPLICABLE',
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const source = await db.researchSource.findUnique({ where: { key: 'bigbuy-public-index' } });
  if (!source) throw new Error('BigBuy public-index ResearchSource not found. Run the research importer first.');

  const rows = await db.researchProduct.findMany({
    where: {
      sourceId: source.id,
      status: { in: ['NORMALIZED', 'SELECTED', 'IMPORTED'] },
      sourceProductId: { not: null },
    },
    orderBy: [{ researchScore: 'desc' }, { createdAt: 'asc' }],
  });

  let created = 0;
  let updated = 0;
  let skippedApproved = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.sourceProductId) continue;

    const supplierId = String(row.sourceProductId);
    const sku = `EC-BB-${supplierId}`;
    const baseSlug = slugify(row.sourceProductName) || 'bigbuy-product';
    const slug = `${baseSlug}-bb-${supplierId}`;
    const sourceData = parseJson(row.sourceDataJson, {});
    const electrical = Boolean(sourceData.electrical);
    const existing = await db.product.findUnique({ where: { sku } });

    // Never downgrade a supplier product that has subsequently completed
    // compliance approval through the official API/CSV pipeline.
    if (existing?.complianceStatus === 'APPROVED' && existing.documentationStatus === 'APPROVED') {
      skippedApproved++;
      continue;
    }

    const shortDescription = row.sourceDescription || `${row.sourceProductName} — supplier catalogue item pending validation.`;
    const subtitleParts = [row.sourceBrand, row.sourceSubcategory].filter(Boolean);
    const categorySlug = categoryFor(row);
    const subcategorySlug = slugify(row.sourceSubcategory || '');

    const data = {
      slug,
      name: row.sourceProductName,
      subtitle: subtitleParts.length ? subtitleParts.join(' · ') : null,
      shortDescription,
      description: row.sourceDescription || shortDescription,
      price: '0.00',
      priceCents: 0,
      comparePrice: null,
      currency: 'EUR',
      categorySlug,
      subcategorySlugs: subcategorySlug,
      spaceSlugs: '',
      styleSlugs: '',
      collectionSlugs: '',
      image: PLACEHOLDER_IMAGE,
      hoverImage: null,
      gallery: '',
      imageStatus: 'PLACEHOLDER',
      badge: null,
      rating: 0,
      reviewCount: 0,
      stock: 0,
      availability: 'outOfStock',
      isBestSeller: false,
      isNew: false,
      featured: false,
      materials: row.sourceMaterials,
      dimensions: row.sourceDimensions,
      weight: row.sourceWeight,
      care: null,
      color: row.sourceColours,
      shippingClass: 'SPECIAL',
      variantsJson: '[]',
      electrical,
      battery: false,
      complianceStatus: 'PENDING_REVIEW',
      reviewMode: 'live',
      documentationStatus: 'PENDING',
      safetyJson: safetyFor(row, electrical),
      requiresComplianceReview: true,
      isDemo: false,
      sourceResearchId: row.id,
      sourceDomain: 'bigbuy.eu',
      sourceUrl: row.sourceUrl,
      sortOrder: -1000 + i,
    };

    if (existing) {
      await db.product.update({ where: { sku }, data });
      updated++;
    } else {
      await db.product.create({ data: { sku, ...data } });
      created++;
    }
  }

  console.log(`BigBuy storefront bridge complete: research=${rows.length} created=${created} updated=${updated} skippedApproved=${skippedApproved}`);
  console.log('All bridged products remain non-saleable: price/stock/media/compliance validation is still required.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
