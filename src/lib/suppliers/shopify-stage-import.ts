import { db } from '@/lib/db';
import {
  SHOPIFY_SUPPLIER_SOURCES,
  scanShopifySupplier,
  type ShopifyScannedProduct,
  type ShopifySourceId,
} from './shopify-public';

const IMPORTABLE_SOURCES = new Set<ShopifySourceId>(['trendhero', 'viceni', 'chickidee', 'wisfor']);

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
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[:\\-]\\s*([^\\n]{2,140})`, 'i'));
    if (match?.[1]) return match[1].replace(/\s+/g, ' ').trim().slice(0, 140);
  }
  return null;
}

function classify(product: ShopifyScannedProduct): {
  categorySlug: string;
  subcategorySlugs: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs: string;
  shippingClass: string;
} {
  const haystack = [product.title, product.productType ?? '', product.tags.join(' ')].join(' ').toLowerCase();

  if (/frame|wall decor|wall art|plaque|clock/.test(haystack)) {
    return {
      categorySlug: 'wall-decor',
      subcategorySlugs: /frame/.test(haystack) ? 'photo-frames' : 'decorative-accessories',
      spaceSlugs: 'living-room,bedroom,entrance',
      styleSlugs: 'contemporary',
      collectionSlugs: 'wall-makeover',
      shippingClass: 'STANDARD',
    };
  }
  if (/vase|artificial plant|artificial flower|silk flower|terrarium|plant/.test(haystack)) {
    return {
      categorySlug: 'decor',
      subcategorySlugs: /terrarium/.test(haystack) ? 'terrariums' : 'vases-plants',
      spaceSlugs: 'living-room,bedroom,home-office',
      styleSlugs: 'natural,organic',
      collectionSlugs: 'green-living,natural-objects',
      shippingClass: /glass|terrarium|vase/.test(haystack) ? 'FRAGILE' : 'STANDARD',
    };
  }
  if (/storage|basket|crate|organis/.test(haystack)) {
    return {
      categorySlug: 'storage',
      subcategorySlugs: 'storage-organisation',
      spaceSlugs: 'living-room,bedroom,bathroom,kitchen',
      styleSlugs: 'modern',
      collectionSlugs: 'small-spaces',
      shippingClass: 'STANDARD',
    };
  }
  if (/glass|bowl|serve|kitchen|dining|pitcher|jar|drinkware|cookware/.test(haystack)) {
    return {
      categorySlug: 'kitchen-dining',
      subcategorySlugs: 'serveware,tableware',
      spaceSlugs: 'kitchen,dining',
      styleSlugs: 'contemporary',
      collectionSlugs: 'everyday-living',
      shippingClass: /glass|ceramic/.test(haystack) ? 'FRAGILE' : 'STANDARD',
    };
  }
  if (/outdoor|garden|patio|balcony/.test(haystack)) {
    return {
      categorySlug: 'outdoor',
      subcategorySlugs: 'outdoor-living',
      spaceSlugs: 'garden,terrace,balcony',
      styleSlugs: 'natural,modern',
      collectionSlugs: 'outdoor-living',
      shippingClass: 'STANDARD',
    };
  }
  return {
    categorySlug: 'decor',
    subcategorySlugs: 'decorative-accessories',
    spaceSlugs: 'living-room,bedroom',
    styleSlugs: 'contemporary',
    collectionSlugs: 'natural-objects',
    shippingClass: 'STANDARD',
  };
}

function isElectrical(product: ShopifyScannedProduct): boolean {
  const value = [product.title, product.productType ?? '', product.tags.join(' '), product.description]
    .join(' ')
    .toLowerCase();
  return /\bled\b|electric|electrical|plug|usb|battery|lamp|lighting|light bulb/.test(value);
}

function mapVariants(product: ShopifyScannedProduct): string {
  const variants = product.variants.filter((v) => v.id && v.title && v.title.toLowerCase() !== 'default title');
  if (!variants.length) return '[]';
  const base = Math.max(0, product.priceMinCents || 0);
  return JSON.stringify(
    variants.slice(0, 30).map((variant) => ({
      id: `${product.sourceId}-${variant.id}`,
      type: 'pack',
      name: variant.title,
      value: slugify(variant.title) || String(variant.id),
      priceDeltaCents: Math.max(0, variant.priceCents - base),
      availability: variant.available ? 'inStock' : 'outOfStock',
    })),
  );
}

function productSku(product: ShopifyScannedProduct): string {
  const source = product.sourceId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const id = (product.shopifyProductId || product.handle).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
  return `EC-SH-${source}-${id}`;
}

async function stageProduct(product: ShopifyScannedProduct, sortOrder: number) {
  const source = SHOPIFY_SUPPLIER_SOURCES[product.sourceId];
  const classification = classify(product);
  const dimensions = firstFact(product.description, ['dimensions', 'dimension', 'measurements', 'measurement', 'size']);
  const materials = firstFact(product.description, ['materials', 'material']);
  const manufacturer = product.vendor || product.sourceName;
  const electrical = isElectrical(product);
  const sku = productSku(product);
  const slug = `supplier-${product.sourceId}-${slugify(product.handle || product.title)}`.slice(0, 180);
  const basePriceCents = Math.max(0, product.priceMinCents || 0);
  const price = (basePriceCents / 100).toFixed(2);
  const image = product.images[0] || '/images/product-serving-board.jpg';
  const hoverImage = product.images[1] || null;
  const gallery = product.images.slice(1, 8).join(',');
  const factualDetails = [
    dimensions ? `Dimensions: ${dimensions}.` : '',
    materials ? `Materials: ${materials}.` : '',
    product.variants.length > 1 ? `${product.variants.length} supplier variants detected.` : '',
  ].filter(Boolean).join(' ');
  const shortDescription = `${product.productType || 'Home & garden product'} by ${manufacturer}. Supplier listing and availability have been captured; trade terms and EU product documentation are being validated before sale.`;
  const description = `${product.title} is a supplier-backed catalogue item sourced from ${product.sourceName}. ${factualDetails} The E-com.casa listing is currently staged while commercial terms, media rights, exact stock quantity and applicable EU/UK product documentation are verified. No unverified customer reviews or scarcity claims are published.`.replace(/\s+/g, ' ').trim();
  const safetyJson = JSON.stringify({
    manufacturerName: manufacturer,
    manufacturerAddress: '[TO BE CONFIRMED FROM SUPPLIER DOCUMENTATION]',
    manufacturerEmail: '[TO BE CONFIRMED FROM SUPPLIER DOCUMENTATION]',
    euResponsiblePerson: '[TO BE CONFIRMED WHERE REQUIRED]',
    productIdentifier: product.variants.find((v) => v.sku)?.sku || sku,
    countryOfOrigin: null,
    warnings: electrical ? ['Electrical/battery characteristics require documentation review before sale.'] : [],
    safetyInstructions: [],
    ceMarking: electrical ? '[TO BE CONFIRMED]' : 'NOT_ESTABLISHED',
    weee: electrical ? '[TO BE CONFIRMED]' : 'NOT_APPLICABLE',
    supplierSourceUrl: product.sourceUrl,
    supplierAvailabilitySignal: product.availabilitySignal,
    inventoryQuantityKnown: false,
  });

  const data = {
    slug,
    sku,
    name: product.title.slice(0, 220),
    subtitle: [product.vendor, product.productType].filter(Boolean).join(' · ').slice(0, 220) || product.sourceName,
    shortDescription,
    description,
    price,
    priceCents: basePriceCents,
    comparePrice: null,
    currency: product.currency,
    ...classification,
    image,
    hoverImage,
    gallery,
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
    variantsJson: mapVariants(product),
    electrical,
    battery: /battery/.test([product.title, product.description].join(' ').toLowerCase()),
    complianceStatus: 'SUPPLIER_PENDING',
    reviewMode: 'live',
    documentationStatus: 'PENDING',
    safetyJson,
    requiresComplianceReview: true,
    isDemo: false,
    sourceResearchId: `shopify-public:${product.sourceId}:${product.shopifyProductId || product.handle}`,
    sourceDomain: new URL(source.origin).hostname,
    sourceUrl: product.sourceUrl,
    sortOrder,
  };

  await db.product.upsert({
    where: { sku },
    create: data,
    update: data,
  });

  return { sku, slug, name: product.title, available: product.available };
}

export async function stageShopifySupplierCatalog(
  sourceId: ShopifySourceId,
  options: { limit?: number } = {},
) {
  if (!IMPORTABLE_SOURCES.has(sourceId)) throw new Error('Supplier is not allow-listed for staging');
  const source = SHOPIFY_SUPPLIER_SOURCES[sourceId];
  const limit = Math.min(80, Math.max(1, options.limit ?? 80));
  const scan = await scanShopifySupplier(sourceId, {
    limit,
    maxCollectionPages: 8,
    delayMs: 250,
  });

  const staged = [] as Array<{ sku: string; slug: string; name: string; available: boolean }>;
  let failed = 0;
  for (const [index, product] of scan.products.entries()) {
    try {
      staged.push(await stageProduct(product, 10_000 + source.priority * 1_000 + index));
    } catch (error) {
      failed += 1;
      console.error('Supplier product staging failed', sourceId, product.handle, error);
    }
  }

  return {
    source: sourceId,
    discovered: scan.productLinksDiscovered,
    fetched: scan.productsFetched,
    staged: staged.length,
    failed,
    blockedByRobots: scan.blockedByRobots,
    warnings: scan.warnings,
    products: staged,
  };
}
