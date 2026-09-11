import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// E-com.casa partner catalogue synchroniser.
// Public Shopify endpoints only: no login, CAPTCHA bypass or authenticated scraping.
// The storefront snapshot remains non-saleable until exact stock/compliance are approved.

const USER_AGENT = 'E-com.casa catalogue sync/1.0 (+https://e-com.casa)';
const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const REQUEST_DELAY_MS = Math.max(250, Number(process.env.PARTNER_CATALOG_DELAY_MS || 450));
const PLACEHOLDER_IMAGE = '/images/product-awaiting-media.svg';
const OUT_DIR = path.join(process.cwd(), 'data', 'catalog');

interface ShopifyImage {
  id?: number;
  src: string;
  alt?: string | null;
}

interface ShopifyOption {
  name: string;
  position?: number;
  values?: string[];
}

interface ShopifyVariant {
  id: number;
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: string | number;
  compare_at_price?: string | number | null;
  available?: boolean;
  grams?: number;
  featured_image?: ShopifyImage | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: ShopifyOption[];
}

interface PartnerCollection {
  handle: string;
  categorySlug: string;
  categoryName: string;
  categorySubtitle: string;
}

interface PartnerConfig {
  key: 'odem' | 'woodupp';
  baseUrl: string;
  manufacturer: string;
  brandFallback: string;
  mediaRights: 'PARTNER_CONFIRMED_BY_MERCHANT' | 'UNCONFIRMED';
  collections: PartnerCollection[];
}

interface CatalogVariant {
  id: string;
  type: 'colour' | 'size' | 'material' | 'pack';
  name: string;
  value: string;
  priceDeltaCents: number;
  image?: string;
  availability?: 'inStock' | 'lowStock' | 'outOfStock';
  sku?: string | null;
  barcode?: string | null;
  supplierVariantId?: string;
  optionValues?: Record<string, string>;
}

interface CatalogProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  subtitle: string | null;
  shortDescription: string;
  description: string;
  price: string;
  priceCents: number;
  comparePrice: string | null;
  currency: 'EUR';
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
  stockKnown: boolean;
  availability: 'inStock' | 'lowStock' | 'outOfStock';
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  color: string | null;
  shippingClass: string;
  variants: CatalogVariant[];
  electrical: boolean;
  battery: boolean;
  complianceStatus: string;
  reviewMode: string;
  documentationStatus: string;
  safetyJson: string | null;
  requiresComplianceReview: boolean;
  isDemo: false;
  brand: string | null;
  manufacturer: string;
  supplierKey: string;
  supplierProductId: string;
  mediaRights: string;
  sourceResearchId: string;
  sourceDomain: string;
  sourceUrl: string;
  sourceImageUrls: string[];
  sortOrder: number;
  createdAt: string;
}

const ODEM_COLLECTIONS: PartnerCollection[] = [
  {
    handle: 'painel-ripado',
    categorySlug: 'painel-ripado',
    categoryName: 'Painéis Ripados',
    categorySubtitle: 'Painéis decorativos e acústicos para paredes e tetos.',
  },
  {
    handle: 'revestimento-exterior-wpc',
    categorySlug: 'revestimento-exterior-wpc',
    categoryName: 'Revestimento Exterior WPC',
    categorySubtitle: 'Painéis e acessórios WPC para fachadas e zonas exteriores.',
  },
  {
    handle: 'revestimento-spc',
    categorySlug: 'revestimento-spc',
    categoryName: 'Revestimento SPC',
    categorySubtitle: 'Revestimentos decorativos de parede em Stone Plastic Composite.',
  },
  {
    handle: 'rodape',
    categorySlug: 'rodapes',
    categoryName: 'Rodapés',
    categorySubtitle: 'Rodapés e perfis de acabamento para interiores.',
  },
  {
    handle: 'sancas',
    categorySlug: 'sancas',
    categoryName: 'Sancas',
    categorySubtitle: 'Sancas e elementos decorativos de acabamento.',
  },
];

const PARTNERS: PartnerConfig[] = [
  {
    key: 'odem',
    baseUrl: 'https://odem.pt',
    manufacturer: 'ODEM-PT',
    brandFallback: 'ODEM',
    mediaRights: 'PARTNER_CONFIRMED_BY_MERCHANT',
    collections: ODEM_COLLECTIONS,
  },
  {
    key: 'woodupp',
    baseUrl: 'https://woodupp.pt',
    manufacturer: 'WoodUpp',
    brandFallback: 'WoodUpp',
    mediaRights: 'UNCONFIRMED',
    collections: [
      {
        handle: 'todos-1',
        categorySlug: 'woodupp-all',
        categoryName: 'WoodUpp',
        categorySubtitle: 'Catálogo público WoodUpp Portugal.',
      },
    ],
  },
];

const EMPTY_SHOP_CATEGORIES = [
  ['lighting', 'Iluminação', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['garden', 'Jardim', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['outdoor', 'Exterior', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['decoration', 'Decoração', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['organisation', 'Organização', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['interior', 'Interior', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
    euro: '€',
  };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, key) => named[key.toLowerCase()] ?? m);
}

function htmlToText(value?: string | null): string {
  if (!value) return '';
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return Math.max(0, value).toFixed(2);
}

function tagsOf(product: ShopifyProduct): string[] {
  if (Array.isArray(product.tags)) return product.tags.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof product.tags === 'string') return product.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function extractDimension(text: string): string | null {
  const match = text.match(/\b\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m)\b/i);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

function inferColour(product: ShopifyProduct): string | null {
  const colourOptionIndex = (product.options ?? []).findIndex((option) => /cor|colour|color|finish|acabamento/i.test(option.name));
  if (colourOptionIndex >= 0) {
    const field = (`option${colourOptionIndex + 1}`) as 'option1' | 'option2' | 'option3';
    const values = [...new Set((product.variants ?? []).map((variant) => variant[field]).filter((v): v is string => Boolean(v && v !== 'Default Title')))];
    if (values.length > 0) return values.join(', ');
  }
  return null;
}

function inferVariantType(product: ShopifyProduct): CatalogVariant['type'] {
  const optionNames = (product.options ?? []).map((option) => option.name).join(' ').toLowerCase();
  if (/cor|colour|color|finish|acabamento/.test(optionNames)) return 'colour';
  if (/size|tamanho|dimens|length|largura|altura|cm|mm/.test(optionNames)) return 'size';
  if (/material|wood|madeira/.test(optionNames)) return 'material';
  return 'pack';
}

function optionValues(product: ShopifyProduct, variant: ShopifyVariant): Record<string, string> {
  const result: Record<string, string> = {};
  (product.options ?? []).slice(0, 3).forEach((option, index) => {
    const key = (`option${index + 1}`) as 'option1' | 'option2' | 'option3';
    const value = variant[key];
    if (value && value !== 'Default Title') result[option.name] = value;
  });
  return result;
}

function inferMaterials(partner: PartnerConfig, categorySlug: string, product: ShopifyProduct, description: string): string | null {
  const text = `${product.title} ${description}`.toLowerCase();
  if (partner.key === 'odem') {
    if (categorySlug === 'revestimento-exterior-wpc') return 'Wood Plastic Composite (WPC)';
    if (categorySlug === 'revestimento-spc') return 'Stone Plastic Composite (SPC)';
    if (/poliestireno|ps anti|rodap|sanca/.test(text)) return 'Poliestireno';
    if (/acústic|acustic|feltro|mdf/.test(text)) return 'MDF, feltro de fibra de poliéster, madeira natural';
  }
  const materialMatch = description.match(/(?:materiais?|material)\s*[:\-]\s*([^\n.]{3,120})/i);
  return materialMatch ? materialMatch[1].trim() : null;
}

function classifyWoodUpp(product: ShopifyProduct): { slug: string; name: string; subtitle: string } {
  const text = `${product.title} ${product.product_type ?? ''} ${tagsOf(product).join(' ')}`.toLowerCase();
  if (/sample|amostra|colour sample|color sample/.test(text)) {
    return { slug: 'amostras', name: 'Amostras', subtitle: 'Amostras de cor e acabamento WoodUpp.' };
  }
  if (/aluwood|exterior|outdoor panel/.test(text)) {
    return { slug: 'paineis-exterior', name: 'Painéis de Exterior', subtitle: 'Sistemas WoodUpp para aplicação exterior.' };
  }
  if (/embrace/.test(text)) {
    if (/accessor|acess|shelf|hook|hanger|cover|storage|suporte/.test(text)) {
      return { slug: 'acessorios-divisorias', name: 'Acessórios para Divisórias', subtitle: 'Acessórios e complementos do sistema Embrace.' };
    }
    return { slug: 'divisorias', name: 'Divisórias de Ambiente', subtitle: 'Sistema modular WoodUpp Embrace.' };
  }
  if (/installation|install|screw|parafus|end lamella|cola|glue|fix|mount/.test(text)) {
    return { slug: 'produtos-instalacao', name: 'Produtos de Instalação', subtitle: 'Fixação, remates e consumíveis de instalação.' };
  }
  if (/akupanel|akupixel|acoustic panel|painel acústico|painel acustico/.test(text)) {
    return { slug: 'paineis-acusticos', name: 'Painéis Acústicos', subtitle: 'Akupanel, Akupixel e sistemas acústicos WoodUpp.' };
  }
  if (/norr|lumi|dupps|liva|nell|create|shelf|pratele|hook|hanger|cabide|magnetic|mirror|espelho|cover|led|storage|arruma|tv mount|suporte/.test(text)) {
    return { slug: 'acessorios', name: 'Acessórios', subtitle: 'Acessórios funcionais e decorativos WoodUpp.' };
  }
  return { slug: 'woodupp-outros', name: 'Outros WoodUpp', subtitle: 'Outros produtos do catálogo público WoodUpp.' };
}

function shippingClass(categorySlug: string, title: string): string {
  const text = `${categorySlug} ${title}`.toLowerCase();
  if (/painel|panel|wpc|spc|rodap|sanca|divis/.test(text)) return 'OVERSIZED';
  if (/mirror|espelho|glass|vidro/.test(text)) return 'FRAGILE';
  return 'STANDARD';
}

function isElectrical(product: ShopifyProduct): boolean {
  const text = `${product.title} ${product.product_type ?? ''} ${tagsOf(product).join(' ')}`.toLowerCase();
  return /\bled\b|striplight|remote|lumi|electric|elétric|electri/.test(text);
}

function hasBattery(product: ShopifyProduct): boolean {
  const text = `${product.title} ${product.product_type ?? ''} ${tagsOf(product).join(' ')}`.toLowerCase();
  return /battery|bateria|pilha/.test(text);
}

function rulePatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}`);
}

function robotsAllows(robots: string, pathname: string): boolean {
  const lines = robots.split(/\r?\n/).map((line) => line.split('#')[0].trim()).filter(Boolean);
  let applies = false;
  const rules: Array<{ allow: boolean; path: string }> = [];
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      applies = value === '*';
      continue;
    }
    if (applies && (field === 'allow' || field === 'disallow') && value) {
      rules.push({ allow: field === 'allow', path: value });
    }
  }
  const matching = rules
    .filter((rule) => rulePatternToRegex(rule.path).test(pathname))
    .sort((a, b) => b.path.length - a.path.length);
  return matching.length === 0 ? true : matching[0].allow;
}

async function fetchWithRetry(url: string, asJson: boolean): Promise<any> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: asJson ? 'application/json,text/plain;q=0.9,*/*;q=0.8' : 'text/plain,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return asJson ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(700 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${String(lastError)}`);
}

async function verifyRobots(partner: PartnerConfig): Promise<void> {
  const robotsUrl = new URL('/robots.txt', partner.baseUrl).toString();
  try {
    const robots = String(await fetchWithRetry(robotsUrl, false));
    const probePath = `/collections/${partner.collections[0].handle}/products.json`;
    if (!robotsAllows(robots, probePath)) {
      throw new Error(`${partner.key}: robots.txt disallows ${probePath}`);
    }
  } catch (error) {
    // Fail closed on an explicit robots denial, but tolerate a missing robots file.
    if (String(error).includes('disallows')) throw error;
    console.warn(`[${partner.key}] robots.txt unavailable; continuing with low-rate public requests:`, String(error));
  }
}

async function fetchCollection(partner: PartnerConfig, collection: PartnerCollection): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const endpoint = new URL(`/collections/${collection.handle}/products.json`, partner.baseUrl);
    endpoint.searchParams.set('limit', String(PAGE_SIZE));
    endpoint.searchParams.set('page', String(page));
    const data = await fetchWithRetry(endpoint.toString(), true) as { products?: ShopifyProduct[] };
    const batch = Array.isArray(data.products) ? data.products : [];
    products.push(...batch);
    console.log(`[${partner.key}] ${collection.handle} page ${page}: ${batch.length}`);
    if (batch.length < PAGE_SIZE) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return products;
}

function chooseSku(partner: PartnerConfig, product: ShopifyProduct, used: Set<string>): string {
  const candidate = (product.variants ?? []).map((variant) => variant.sku?.trim()).find(Boolean);
  let sku = candidate || `${partner.key === 'odem' ? 'ODEM' : 'WOODUPP'}-${product.id}`;
  if (used.has(sku)) sku = `${sku}-${product.id}`;
  used.add(sku);
  return sku;
}

function normalizeProduct(
  partner: PartnerConfig,
  collection: PartnerCollection,
  product: ShopifyProduct,
  index: number,
  usedSkus: Set<string>,
): CatalogProduct {
  const description = htmlToText(product.body_html);
  const variants = product.variants ?? [];
  const numericPrices = variants.map((variant) => parseMoney(variant.price)).filter((value) => value > 0);
  const basePrice = numericPrices.length > 0 ? Math.min(...numericPrices) : 0;
  const basePriceCents = Math.round(basePrice * 100);
  const compareCandidates = variants
    .map((variant) => parseMoney(variant.compare_at_price))
    .filter((value) => value > basePrice);
  const comparePrice = compareCandidates.length > 0 ? money(Math.min(...compareCandidates)) : null;
  const category = partner.key === 'woodupp'
    ? classifyWoodUpp(product)
    : { slug: collection.categorySlug, name: collection.categoryName, subtitle: collection.categorySubtitle };
  const available = variants.some((variant) => variant.available === true);
  const remoteImages = (product.images ?? []).map((image) => image.src).filter(Boolean);
  const publishPartnerMedia = partner.mediaRights === 'PARTNER_CONFIRMED_BY_MERCHANT';
  const primaryImage = publishPartnerMedia ? remoteImages[0] ?? PLACEHOLDER_IMAGE : PLACEHOLDER_IMAGE;
  const hoverImage = publishPartnerMedia ? remoteImages[1] ?? null : null;
  const gallery = publishPartnerMedia ? remoteImages.slice(1).join(',') : '';
  const variantType = inferVariantType(product);
  const catalogVariants: CatalogVariant[] = variants.length === 1 && variants[0]?.title === 'Default Title'
    ? []
    : variants.map((variant) => {
        const variantPrice = parseMoney(variant.price);
        const values = optionValues(product, variant);
        return {
          id: `${partner.key}-${variant.id}`,
          type: variantType,
          name: variant.title || Object.values(values).join(' / ') || 'Opção',
          value: slugify(variant.title || Object.values(values).join('-') || String(variant.id)),
          priceDeltaCents: Math.round(variantPrice * 100) - basePriceCents,
          image: publishPartnerMedia ? variant.featured_image?.src : undefined,
          availability: variant.available === false ? 'outOfStock' : 'inStock',
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          supplierVariantId: String(variant.id),
          optionValues: values,
        };
      });
  const tags = tagsOf(product);
  const dimension = extractDimension(`${product.title}\n${description}\n${variants.map((variant) => variant.title).join('\n')}`);
  const sourceUrl = new URL(`/products/${product.handle}`, partner.baseUrl).toString();
  const manufacturer = partner.manufacturer;
  const supplierProductId = String(product.id);
  const electrical = isElectrical(product);
  const battery = hasBattery(product);
  const sku = chooseSku(partner, product, usedSkus);
  const shortDescription = (description.split('\n').find((line) => line.trim().length > 30) || description || product.title).slice(0, 260);
  const safetyJson = JSON.stringify({
    manufacturerName: manufacturer,
    productIdentifier: sku,
    supplierProductId,
    sourceUrl,
    warnings: [],
    safetyInstructions: [],
    complianceNote: 'Supplier catalogue data imported; technical/compliance documents require E-com.casa approval before sale.',
  });

  return {
    id: `partner-${partner.key}-${product.id}`,
    slug: `${partner.key}-${product.handle}`,
    sku,
    name: product.title,
    subtitle: `${manufacturer}${product.product_type ? ` · ${product.product_type}` : ''}`,
    shortDescription,
    description: description || product.title,
    price: money(basePrice),
    priceCents: basePriceCents,
    comparePrice,
    currency: 'EUR',
    categorySlug: category.slug,
    subcategorySlugs: [slugify(product.product_type || ''), ...tags.map(slugify)].filter(Boolean).slice(0, 12).join(','),
    spaceSlugs: '',
    styleSlugs: '',
    collectionSlugs: `${partner.key},${partner.key}-${collection.handle}`,
    image: primaryImage,
    hoverImage,
    gallery,
    imageStatus: publishPartnerMedia ? 'LICENSED' : 'RIGHTS_REVIEW',
    badge: null,
    rating: 0,
    reviewCount: 0,
    stock: 0,
    stockKnown: false,
    availability: available ? 'inStock' : 'outOfStock',
    isBestSeller: false,
    isNew: false,
    featured: partner.key === 'odem' && category.slug === 'painel-ripado',
    materials: inferMaterials(partner, category.slug, product, description),
    dimensions: dimension,
    weight: null,
    care: null,
    color: inferColour(product),
    shippingClass: shippingClass(category.slug, product.title),
    variants: catalogVariants,
    electrical,
    battery,
    complianceStatus: 'PENDING_REVIEW',
    reviewMode: 'live',
    documentationStatus: 'PENDING',
    safetyJson,
    requiresComplianceReview: true,
    isDemo: false,
    brand: product.vendor?.trim() || partner.brandFallback,
    manufacturer,
    supplierKey: partner.key,
    supplierProductId,
    mediaRights: partner.mediaRights,
    sourceResearchId: `partner:${partner.key}:${product.id}`,
    sourceDomain: new URL(partner.baseUrl).hostname,
    sourceUrl,
    sourceImageUrls: remoteImages,
    sortOrder: index,
    createdAt: product.published_at || product.created_at || new Date().toISOString(),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const all: CatalogProduct[] = [];
  const sourceCounts: Record<string, number> = {};
  const categoryMap = new Map<string, { id: string; slug: string; name: string; type: 'shop'; image: string | null; subtitle: string | null; sortOrder: number }>();
  const usedSkus = new Set<string>();
  const warnings: string[] = [];

  for (const partner of PARTNERS) {
    await verifyRobots(partner);
    const seenPartnerProducts = new Map<number, { product: ShopifyProduct; collection: PartnerCollection }>();
    for (const collection of partner.collections) {
      const products = await fetchCollection(partner, collection);
      sourceCounts[`${partner.key}:${collection.handle}`] = products.length;
      for (const product of products) {
        if (!seenPartnerProducts.has(product.id)) seenPartnerProducts.set(product.id, { product, collection });
      }
      await sleep(REQUEST_DELAY_MS);
    }

    let partnerIndex = 0;
    for (const { product, collection } of seenPartnerProducts.values()) {
      const normalized = normalizeProduct(partner, collection, product, all.length + partnerIndex, usedSkus);
      all.push(normalized);
      if (!categoryMap.has(normalized.categorySlug)) {
        const woodUppCategory = partner.key === 'woodupp' ? classifyWoodUpp(product) : null;
        categoryMap.set(normalized.categorySlug, {
          id: `category-shop-${normalized.categorySlug}`,
          slug: normalized.categorySlug,
          name: woodUppCategory?.name ?? collection.categoryName,
          type: 'shop',
          image: normalized.image !== PLACEHOLDER_IMAGE ? normalized.image : null,
          subtitle: woodUppCategory?.subtitle ?? collection.categorySubtitle,
          sortOrder: categoryMap.size + 1,
        });
      }
      partnerIndex += 1;
    }
  }

  for (const [slug, name, subtitle] of EMPTY_SHOP_CATEGORIES) {
    if (!categoryMap.has(slug)) {
      categoryMap.set(slug, {
        id: `category-shop-${slug}`,
        slug,
        name,
        type: 'shop',
        image: null,
        subtitle,
        sortOrder: 100 + categoryMap.size,
      });
    }
  }

  const odemCount = all.filter((product) => product.supplierKey === 'odem').length;
  const woodUppCount = all.filter((product) => product.supplierKey === 'woodupp').length;
  if (odemCount < 40) throw new Error(`Safety stop: expected at least 40 ODEM products, got ${odemCount}`);
  if (woodUppCount < 200) throw new Error(`Safety stop: expected at least 200 WoodUpp products, got ${woodUppCount}`);
  if (all.length < 240) throw new Error(`Safety stop: catalogue unexpectedly small (${all.length})`);

  const odemCategoryCounts = Object.fromEntries(
    ODEM_COLLECTIONS.map((collection) => [collection.categorySlug, all.filter((product) => product.supplierKey === 'odem' && product.categorySlug === collection.categorySlug).length]),
  );
  const woodUppCategoryCounts = Object.fromEntries(
    [...new Set(all.filter((product) => product.supplierKey === 'woodupp').map((product) => product.categorySlug))]
      .sort()
      .map((slug) => [slug, all.filter((product) => product.supplierKey === 'woodupp' && product.categorySlug === slug).length]),
  );

  if (all.some((product) => product.mediaRights === 'UNCONFIRMED' && product.image !== PLACEHOLDER_IMAGE)) {
    throw new Error('Safety stop: unconfirmed media rights leaked into storefront image fields.');
  }

  const generatedAt = new Date().toISOString();
  const catalogue = {
    generatedAt,
    mode: 'partner-production-staging',
    categories: [...categoryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    subcategories: [],
    sourceCounts,
    note: 'Real supplier/manufacturer catalogue snapshot. No demo products. Products remain non-saleable until exact inventory and compliance/documentation are approved.',
  };
  const report = {
    generatedAt,
    totalProducts: all.length,
    odemProducts: odemCount,
    woodUppProducts: woodUppCount,
    odemCategoryCounts,
    woodUppCategoryCounts,
    sourceCounts,
    publishableMedia: { odem: 'PARTNER_CONFIRMED_BY_MERCHANT', woodupp: 'UNCONFIRMED' },
    exactStockAvailable: false,
    saleability: 'BLOCKED_PENDING_STOCK_AND_COMPLIANCE',
    warnings,
  };

  await Promise.all([
    writeFile(path.join(OUT_DIR, 'generated-provider-products.json'), `${JSON.stringify(all, null, 2)}\n`, 'utf8'),
    writeFile(path.join(OUT_DIR, 'generated-provider-catalog.json'), `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8'),
    writeFile(path.join(OUT_DIR, 'provider-sync-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  ]);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
