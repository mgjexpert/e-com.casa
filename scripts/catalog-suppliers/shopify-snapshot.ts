import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SHOPIFY_SUPPLIER_SOURCES,
  scanShopifySupplier,
  type ShopifyScannedProduct,
  type ShopifySourceId,
} from '../../src/lib/suppliers/shopify-public';
import type { CatalogProduct, ProductVariant } from '../../src/lib/catalog/types';

const SOURCE_IDS: ShopifySourceId[] = ['trendhero', 'viceni', 'chickidee', 'wisfor'];
const LIMIT_PER_SOURCE = Math.min(80, Math.max(10, Number(process.env.SHOPIFY_SNAPSHOT_LIMIT || 80)));
const OUTPUT = path.join(process.cwd(), 'data', 'catalog', 'generated-supplier-products.json');

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function firstFact(text: string, labels: string[]): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const label of labels) {
    const lower = label.toLowerCase();
    const line = lines.find((item) => item.toLowerCase().startsWith(`${lower}:`) || item.toLowerCase().startsWith(`${lower} -`));
    if (!line) continue;
    const value = line.replace(/^[^:\-]+[:\-]\s*/, '').replace(/\s+/g, ' ').trim();
    if (value) return value.slice(0, 160);
  }
  return null;
}

function classify(product: ShopifyScannedProduct) {
  const haystack = [product.title, product.productType ?? '', product.tags.join(' ')].join(' ').toLowerCase();
  if (/frame|wall decor|wall art|plaque|clock/.test(haystack)) {
    return { categorySlug: 'decoration', subcategorySlugs: /frame/.test(haystack) ? 'mirrors' : '', spaceSlugs: 'living-room,bedroom,entrance', styleSlugs: 'modern', collectionSlugs: 'wall-makeover', shippingClass: 'STANDARD' };
  }
  if (/terrarium|plant|planter|vase|flower/.test(haystack)) {
    return { categorySlug: /planter|plant/.test(haystack) ? 'planters' : 'decoration', subcategorySlugs: '', spaceSlugs: 'living-room,bedroom,home-office', styleSlugs: 'natural,organic', collectionSlugs: 'green-living,natural-objects', shippingClass: /glass|terrarium|vase/.test(haystack) ? 'FRAGILE' : 'STANDARD' };
  }
  if (/storage|basket|crate|organis/.test(haystack)) {
    return { categorySlug: 'organisation', subcategorySlugs: '', spaceSlugs: 'living-room,bedroom,bathroom,kitchen', styleSlugs: 'modern', collectionSlugs: 'small-spaces', shippingClass: 'STANDARD' };
  }
  if (/glass|bowl|serve|kitchen|dining|pitcher|jar|drinkware|cookware|plate|mug|cup/.test(haystack)) {
    return { categorySlug: 'kitchen-dining', subcategorySlugs: '', spaceSlugs: 'kitchen,dining', styleSlugs: 'modern', collectionSlugs: 'modern-essentials', shippingClass: /glass|ceramic/.test(haystack) ? 'FRAGILE' : 'STANDARD' };
  }
  if (/outdoor|garden|patio|balcony|barbecue|bbq/.test(haystack)) {
    return { categorySlug: 'outdoor', subcategorySlugs: '', spaceSlugs: 'garden,balcony', styleSlugs: 'natural,modern', collectionSlugs: 'outdoor-living', shippingClass: 'STANDARD' };
  }
  return { categorySlug: 'decoration', subcategorySlugs: '', spaceSlugs: 'living-room,bedroom', styleSlugs: 'modern', collectionSlugs: 'modern-essentials', shippingClass: 'STANDARD' };
}

function detectElectrical(product: ShopifyScannedProduct): boolean {
  return /\bled\b|electric|electrical|plug|usb|battery|lamp|lighting|light bulb/i.test(
    [product.title, product.productType ?? '', product.tags.join(' '), product.description].join(' '),
  );
}

function variantsFor(product: ShopifyScannedProduct): ProductVariant[] {
  const base = Math.max(0, product.priceMinCents || 0);
  return product.variants
    .filter((variant) => variant.id && variant.title && variant.title.toLowerCase() !== 'default title')
    .slice(0, 30)
    .map((variant) => ({
      id: `${product.sourceId}-${variant.id}`,
      type: 'pack',
      name: variant.title,
      value: slugify(variant.title) || String(variant.id),
      priceDeltaCents: Math.max(0, variant.priceCents - base),
      availability: variant.available ? 'inStock' : 'outOfStock',
    }));
}

function mapProduct(product: ShopifyScannedProduct, index: number): CatalogProduct {
  const source = SHOPIFY_SUPPLIER_SOURCES[product.sourceId];
  const classification = classify(product);
  const dimensions = firstFact(product.description, ['dimensions', 'dimension', 'measurements', 'measurement', 'size']);
  const materials = firstFact(product.description, ['materials', 'material']);
  const electrical = detectElectrical(product);
  const sourceCode = product.sourceId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const stableId = (product.shopifyProductId || product.handle).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
  const sku = `EC-SH-${sourceCode}-${stableId}`;
  const slug = `supplier-${product.sourceId}-${slugify(product.handle || product.title)}`.slice(0, 180);
  const priceCents = Math.max(0, product.priceMinCents || 0);
  const manufacturer = product.vendor || product.sourceName;
  const image = product.images[0] || '/images/product-ceramic-vase-set.jpg';
  const imageGallery = product.images.slice(1, 8);
  const factParts = [
    product.productType ? `Type: ${product.productType}.` : '',
    materials ? `Materials: ${materials}.` : '',
    dimensions ? `Dimensions: ${dimensions}.` : '',
    product.variants.length > 1 ? `${product.variants.length} supplier variants detected.` : '',
  ].filter(Boolean).join(' ');

  return {
    id: `supplier-${product.sourceId}-${stableId}`,
    slug,
    sku,
    name: product.title.slice(0, 220),
    subtitle: [manufacturer, product.productType].filter(Boolean).join(' · ').slice(0, 220) || source.name,
    shortDescription: `${product.productType || 'Home & garden item'} from ${manufacturer}. Supplier listing and public availability have been captured for E-com.casa validation.`,
    description: `${product.title} is a supplier-backed catalogue candidate sourced from ${source.name}. ${factParts} Commercial terms, media rights, exact stock quantity and applicable EU/UK product documentation must be validated before checkout is enabled.`.replace(/\s+/g, ' ').trim(),
    price: (priceCents / 100).toFixed(2),
    priceCents,
    comparePrice: null,
    currency: product.currency,
    ...classification,
    image,
    hoverImage: imageGallery[0] || null,
    gallery: imageGallery.join(','),
    imageStatus: 'SUPPLIER_REFERENCE',
    badge: null,
    rating: 0,
    reviewCount: 0,
    stock: product.available ? 1 : 0,
    availability: product.available ? 'inStock' : 'outOfStock',
    isBestSeller: false,
    isNew: false,
    featured: false,
    materials,
    dimensions,
    weight: null,
    care: null,
    color: null,
    variants: variantsFor(product),
    electrical,
    battery: /battery/i.test([product.title, product.description].join(' ')),
    complianceStatus: 'SUPPLIER_PENDING',
    reviewMode: 'live',
    documentationStatus: 'PENDING',
    safetyJson: JSON.stringify({
      manufacturerName: manufacturer,
      manufacturerAddress: '[TO BE CONFIRMED FROM SUPPLIER DOCUMENTATION]',
      manufacturerEmail: '[TO BE CONFIRMED FROM SUPPLIER DOCUMENTATION]',
      euResponsiblePerson: '[TO BE CONFIRMED WHERE REQUIRED]',
      productIdentifier: product.variants.find((variant) => variant.sku)?.sku || sku,
      countryOfOrigin: null,
      warnings: electrical ? ['Electrical/battery characteristics require documentation review before sale.'] : [],
      safetyInstructions: [],
      ceMarking: electrical ? '[TO BE CONFIRMED]' : 'NOT_ESTABLISHED',
      weee: electrical ? '[TO BE CONFIRMED]' : 'NOT_APPLICABLE',
      supplierSourceUrl: product.sourceUrl,
      supplierAvailabilitySignal: product.availabilitySignal,
      inventoryQuantityKnown: false,
    }),
    requiresComplianceReview: true,
    isDemo: false,
    sourceResearchId: `shopify-public:${product.sourceId}:${product.shopifyProductId || product.handle}`,
    createdAt: new Date().toISOString(),
    sourceDomain: new URL(source.origin).hostname,
    sourceUrl: product.sourceUrl,
    sortOrder: 10_000 + source.priority * 1_000 + index,
  } as CatalogProduct & { sourceDomain: string; sourceUrl: string; sortOrder: number };
}

async function main() {
  const all: CatalogProduct[] = [];
  const summary: Record<string, unknown> = {};

  for (const sourceId of SOURCE_IDS) {
    try {
      console.log(`Scanning ${sourceId} (limit ${LIMIT_PER_SOURCE})...`);
      const scan = await scanShopifySupplier(sourceId, { limit: LIMIT_PER_SOURCE, maxCollectionPages: 8, delayMs: 250 });
      const products = scan.products.map((product, index) => mapProduct(product, index));
      all.push(...products);
      summary[sourceId] = {
        discovered: scan.productLinksDiscovered,
        fetched: scan.productsFetched,
        blockedByRobots: scan.blockedByRobots,
        warnings: scan.warnings,
      };
      console.log(`${sourceId}: ${products.length} products captured.`);
    } catch (error) {
      summary[sourceId] = { error: error instanceof Error ? error.message : String(error) };
      console.error(`${sourceId}: scan failed`, error);
    }
  }

  const deduped = [...new Map(all.map((product) => [product.sku, product])).values()];
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(deduped, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: OUTPUT, total: deduped.length, sources: summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
