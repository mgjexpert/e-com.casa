import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UA = 'E-com.casa catalogue sync/1.1 (+https://e-com.casa)';
const DELAY_MS = Math.max(300, Number(process.env.PARTNER_CATALOG_DELAY_MS || 500));
const PAGE_SIZE = 250;
const MAX_PAGES = 10;
const OUT_DIR = path.join(process.cwd(), 'data', 'catalog');
const PLACEHOLDER = '/images/product-awaiting-media.svg';

type Availability = 'inStock' | 'lowStock' | 'outOfStock';
type VariantType = 'colour' | 'size' | 'material' | 'pack';

type ShopifyImage = { id?: number; src?: string; alt?: string | null };
type ShopifyOption = { name?: string; position?: number; values?: string[] };
type ShopifyVariant = {
  id?: number | string;
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  available?: boolean;
  grams?: number;
  featured_image?: ShopifyImage | null;
};
type ShopifyProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
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
};

type Category = {
  id: string;
  slug: string;
  name: string;
  type: 'shop';
  image: string | null;
  subtitle: string | null;
  sortOrder: number;
};

type Variant = {
  id: string;
  type: VariantType;
  name: string;
  value: string;
  priceDeltaCents: number;
  image?: string;
  availability?: Availability;
  sku?: string | null;
  barcode?: string | null;
  supplierVariantId?: string;
  optionValues?: Record<string, string>;
};

type PartnerProduct = {
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
  stockKnown: false;
  stockUnlimited: true;
  availability: Availability;
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string | null;
  dimensions: string | null;
  weight: string | null;
  care: string | null;
  color: string | null;
  shippingClass: string;
  variants: Variant[];
  brand: string | null;
  manufacturer: string;
  electrical: boolean;
  battery: boolean;
  complianceStatus: 'PENDING_REVIEW';
  reviewMode: 'live';
  documentationStatus: 'PENDING';
  safetyJson: string;
  requiresComplianceReview: true;
  isDemo: false;
  supplierKey: 'odem' | 'woodupp';
  supplierProductId: string;
  mediaRights: 'PARTNER_CONFIRMED_BY_MERCHANT' | 'UNCONFIRMED';
  sourceResearchId: string;
  sourceDomain: string;
  sourceUrl: string;
  sourceImageUrls: string[];
  sortOrder: number;
  createdAt: string;
};

type OdemCollection = {
  handle: string;
  slug: string;
  name: string;
  subtitle: string;
};

const ODEM: OdemCollection[] = [
  { handle: 'painel-ripado', slug: 'painel-ripado', name: 'Painéis Ripados', subtitle: 'Painéis decorativos e acústicos para paredes e tetos.' },
  { handle: 'revestimento-exterior-wpc', slug: 'revestimento-exterior-wpc', name: 'Revestimento Exterior WPC', subtitle: 'Painéis e acessórios WPC para fachadas e zonas exteriores.' },
  { handle: 'revestimento-spc', slug: 'revestimento-spc', name: 'Revestimento SPC', subtitle: 'Revestimentos decorativos de parede em Stone Plastic Composite.' },
  { handle: 'rodape', slug: 'rodapes', name: 'Rodapés', subtitle: 'Rodapés e perfis de acabamento para interiores.' },
  { handle: 'sancas', slug: 'sancas', name: 'Sancas', subtitle: 'Sancas e elementos decorativos de acabamento.' },
];

const WOODUPP_CATEGORIES: Array<[string, string, string]> = [
  ['paineis-acusticos', 'Painéis Acústicos', 'Akupanel, Akupixel e sistemas acústicos WoodUpp.'],
  ['acessorios', 'Acessórios', 'Acessórios funcionais e decorativos para sistemas WoodUpp.'],
  ['produtos-instalacao', 'Produtos de Instalação', 'Fixação, remates e consumíveis de instalação.'],
  ['divisorias', 'Divisórias de Ambiente', 'Sistemas modulares WoodUpp Embrace.'],
  ['acessorios-divisorias', 'Acessórios para Divisórias', 'Acessórios e complementos do sistema Embrace.'],
  ['paineis-exterior', 'Painéis de Exterior', 'Sistemas WoodUpp para aplicação exterior.'],
  ['amostras', 'Amostras', 'Amostras de cor e acabamento WoodUpp.'],
  ['woodupp-outros', 'Outros WoodUpp', 'Outros produtos do catálogo público WoodUpp.'],
];

const EMPTY_CATEGORIES: Array<[string, string, string]> = [
  ['lighting', 'Iluminação', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['garden', 'Jardim', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['outdoor', 'Exterior', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['decoration', 'Decoração', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['organisation', 'Organização', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
  ['interior', 'Interior', 'Categoria preparada; ainda sem produtos de fornecedor aprovados.'],
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', euro: '€' };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (full, key) => named[key.toLowerCase()] ?? full);
}

function htmlToText(value?: string | null): string {
  if (!value) return '';
  return decodeEntities(
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

function tags(product: ShopifyProduct): string[] {
  if (Array.isArray(product.tags)) return product.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof product.tags === 'string') return product.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function price(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value.trim().replace(/\s/g, '').replace(/€/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return Math.max(0, value).toFixed(2);
}

function images(product: ShopifyProduct): string[] {
  return [...new Set((product.images ?? []).map((image) => image?.src).filter((src): src is string => Boolean(src)))];
}

function dimensionOf(product: ShopifyProduct, description: string): string | null {
  const source = `${product.title ?? ''}\n${description}\n${(product.variants ?? []).map((v) => v.title ?? '').join('\n')}`;
  const match = source.match(/\b\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m)\b/i);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

function optionValues(product: ShopifyProduct, variant: ShopifyVariant): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < Math.min(3, product.options?.length ?? 0); i += 1) {
    const option = product.options?.[i];
    const key = `option${i + 1}` as 'option1' | 'option2' | 'option3';
    const value = variant[key];
    if (option?.name && value && value !== 'Default Title') out[option.name] = value;
  }
  return out;
}

function variantType(product: ShopifyProduct): VariantType {
  const names = (product.options ?? []).map((option) => option.name ?? '').join(' ').toLowerCase();
  if (/cor|colour|color|finish|acabamento|felt/.test(names)) return 'colour';
  if (/size|tamanho|dimens|length|largura|altura|cm|mm/.test(names)) return 'size';
  if (/material|wood|madeira/.test(names)) return 'material';
  return 'pack';
}

function colourOf(product: ShopifyProduct): string | null {
  const idx = (product.options ?? []).findIndex((option) => /cor|colour|color|finish|acabamento|felt/i.test(option.name ?? ''));
  if (idx < 0) return null;
  const key = `option${idx + 1}` as 'option1' | 'option2' | 'option3';
  const values = [...new Set((product.variants ?? []).map((variant) => variant[key]).filter((v): v is string => Boolean(v && v !== 'Default Title')))];
  return values.length ? values.join(', ') : null;
}

function isElectrical(product: ShopifyProduct): boolean {
  return /\bled\b|lamp|lighting|light|electric|elétric|electri|striplight/i.test(`${product.title ?? ''} ${product.product_type ?? ''} ${tags(product).join(' ')}`);
}

function hasBattery(product: ShopifyProduct): boolean {
  return /battery|bateria|pilha/i.test(`${product.title ?? ''} ${product.product_type ?? ''} ${tags(product).join(' ')}`);
}

function woodUppCategory(product: ShopifyProduct): { slug: string; name: string; subtitle: string } {
  const text = `${product.title ?? ''} ${product.product_type ?? ''} ${tags(product).join(' ')}`.toLowerCase();
  if (/sample|amostra|colour sample|color sample/.test(text)) return { slug: 'amostras', name: 'Amostras', subtitle: 'Amostras de cor e acabamento WoodUpp.' };
  if (/aluwood|exterior|outdoor panel/.test(text)) return { slug: 'paineis-exterior', name: 'Painéis de Exterior', subtitle: 'Sistemas WoodUpp para aplicação exterior.' };
  if (/embrace/.test(text)) {
    if (/accessor|acess|shelf|hook|hanger|cover|storage|suporte/.test(text)) return { slug: 'acessorios-divisorias', name: 'Acessórios para Divisórias', subtitle: 'Acessórios e complementos do sistema Embrace.' };
    return { slug: 'divisorias', name: 'Divisórias de Ambiente', subtitle: 'Sistemas modulares WoodUpp Embrace.' };
  }
  if (/installation|install|screw|parafus|end lamella|cola|glue|fix|mount/.test(text)) return { slug: 'produtos-instalacao', name: 'Produtos de Instalação', subtitle: 'Fixação, remates e consumíveis de instalação.' };
  if (/akupanel|akupixel|acoustic panel|painel acústico|painel acustico/.test(text)) return { slug: 'paineis-acusticos', name: 'Painéis Acústicos', subtitle: 'Akupanel, Akupixel e sistemas acústicos WoodUpp.' };
  if (/norr|lumi|dupps|liva|nell|create|shelf|pratele|hook|hanger|cabide|magnetic|mirror|espelho|cover|led|storage|arruma|tv mount|suporte|lamp/.test(text)) return { slug: 'acessorios', name: 'Acessórios', subtitle: 'Acessórios funcionais e decorativos para sistemas WoodUpp.' };
  return { slug: 'woodupp-outros', name: 'Outros WoodUpp', subtitle: 'Outros produtos do catálogo público WoodUpp.' };
}

function odemMaterial(category: string, product: ShopifyProduct, description: string): string | null {
  const text = `${product.title ?? ''} ${description}`.toLowerCase();
  if (category === 'revestimento-exterior-wpc') return 'Wood Plastic Composite (WPC)';
  if (category === 'revestimento-spc') return 'Stone Plastic Composite (SPC)';
  if (/poliestireno|rodap|sanca|ps anti/.test(text)) return 'Poliestireno';
  if (/feltro|mdf|acústic|acustic/.test(text)) return 'MDF, feltro de fibra de poliéster, folha de madeira natural';
  const explicit = description.match(/(?:material|materiais)\s*[:\-]\s*([^\n.]{3,120})/i);
  return explicit?.[1]?.trim() ?? null;
}

function shippingClass(category: string, title: string): string {
  const text = `${category} ${title}`.toLowerCase();
  if (/painel|panel|wpc|spc|rodap|sanca|divis|lamella/.test(text)) return 'OVERSIZED';
  if (/mirror|espelho|glass|vidro/.test(text)) return 'FRAGILE';
  return 'STANDARD';
}

type Rule = { allow: boolean; path: string };
function robotPattern(pattern: string): RegExp {
  const ends = pattern.endsWith('$');
  const raw = ends ? pattern.slice(0, -1) : pattern;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${ends ? '$' : ''}`);
}

function robotsAllows(robots: string, pathname: string): boolean {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let group: { agents: string[]; rules: Rule[] } | null = null;
  let hasRules = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasRules) {
        group = { agents: [], rules: [] };
        groups.push(group);
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && group && value) {
      hasRules = true;
      group.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const applicable = groups.filter((candidate) => candidate.agents.some((agent) => agent === '*' || 'e-com.casa catalogue sync'.startsWith(agent)));
  const matches = applicable
    .flatMap((candidate) => candidate.rules)
    .filter((rule) => robotPattern(rule.path).test(pathname))
    .sort((a, b) => b.path.replace(/[\*$]/g, '').length - a.path.replace(/[\*$]/g, '').length || Number(b.allow) - Number(a.allow));
  return matches.length === 0 ? true : matches[0].allow;
}

async function fetchText(url: string): Promise<string> {
  let error: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' }, redirect: 'follow' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (caught) {
      error = caught;
      if (attempt < 3) await sleep(700 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${String(error)}`);
}

async function fetchProducts(origin: string, endpointPath: string): Promise<ShopifyProduct[]> {
  let robots = '';
  try {
    robots = await fetchText(`${origin}/robots.txt`);
  } catch (error) {
    console.warn(`${origin}: robots.txt unavailable; continuing conservatively`, String(error));
  }
  if (robots && !robotsAllows(robots, endpointPath)) throw new Error(`${origin}: robots.txt disallows ${endpointPath}`);

  const out: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const endpoint = new URL(endpointPath, origin);
    endpoint.searchParams.set('limit', String(PAGE_SIZE));
    endpoint.searchParams.set('page', String(page));
    const parsed = JSON.parse(await fetchText(endpoint.toString())) as { products?: ShopifyProduct[] };
    const batch = Array.isArray(parsed.products) ? parsed.products : [];
    console.log(`${endpoint.pathname} page ${page}: ${batch.length}`);
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  return out;
}

function uniqueSku(prefix: string, product: ShopifyProduct, used: Set<string>): string {
  const supplierSku = (product.variants ?? []).map((variant) => variant.sku?.trim()).find(Boolean);
  const id = String(product.id ?? product.handle ?? Math.random());
  let candidate = supplierSku || `${prefix}-${id}`;
  if (used.has(candidate)) candidate = `${candidate}-${id}`;
  used.add(candidate);
  return candidate;
}

function normalize(
  supplierKey: 'odem' | 'woodupp',
  product: ShopifyProduct,
  category: { slug: string; name: string; subtitle: string },
  index: number,
  usedSkus: Set<string>,
): PartnerProduct {
  const id = String(product.id ?? product.handle ?? index);
  const handle = product.handle || slugify(product.title || id);
  const description = htmlToText(product.body_html);
  const variants = product.variants ?? [];
  const prices = variants.map((variant) => price(variant.price)).filter((value) => value > 0);
  const base = prices.length ? Math.min(...prices) : 0;
  const baseCents = Math.round(base * 100);
  const compareCandidates = variants.map((variant) => price(variant.compare_at_price)).filter((value) => value > base);
  const remoteImages = images(product);
  const odem = supplierKey === 'odem';
  const manufacturer = odem ? 'ODEM-PT' : 'WoodUpp';
  const mediaRights = odem ? 'PARTNER_CONFIRMED_BY_MERCHANT' : 'UNCONFIRMED';
  const sourceOrigin = odem ? 'https://odem.pt' : 'https://woodupp.pt';
  const publishImages = odem;
  const sourceUrl = `${sourceOrigin}/products/${handle}`;
  const sku = uniqueSku(odem ? 'ODEM' : 'WOODUPP', product, usedSkus);
  const vType = variantType(product);
  const mappedVariants: Variant[] = variants.length === 1 && (variants[0]?.title ?? '').toLowerCase() === 'default title'
    ? []
    : variants.map((variant) => {
        const values = optionValues(product, variant);
        const title = variant.title || Object.values(values).join(' / ') || 'Opção';
        return {
          id: `${supplierKey}-${variant.id ?? slugify(title)}`,
          type: vType,
          name: title,
          value: slugify(title) || String(variant.id ?? ''),
          priceDeltaCents: Math.round(price(variant.price) * 100) - baseCents,
          image: publishImages ? variant.featured_image?.src : undefined,
          availability: 'inStock',
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          supplierVariantId: String(variant.id ?? ''),
          optionValues: values,
        };
      });
  const short = (description.split('\n').find((line) => line.trim().length > 30) || description || product.title || 'Produto do catálogo parceiro').slice(0, 260);
  const material = odem ? odemMaterial(category.slug, product, description) : null;
  const electrical = isElectrical(product);
  const battery = hasBattery(product);

  return {
    id: `partner-${supplierKey}-${id}`,
    slug: `${supplierKey}-${handle}`,
    sku,
    name: product.title || handle,
    subtitle: `${manufacturer}${product.product_type ? ` · ${product.product_type}` : ''}`,
    shortDescription: short,
    description: description || product.title || handle,
    price: money(base),
    priceCents: baseCents,
    comparePrice: compareCandidates.length ? money(Math.min(...compareCandidates)) : null,
    currency: 'EUR',
    categorySlug: category.slug,
    subcategorySlugs: [slugify(product.product_type || ''), ...tags(product).map(slugify)].filter(Boolean).slice(0, 14).join(','),
    spaceSlugs: '',
    styleSlugs: '',
    collectionSlugs: `${supplierKey},${supplierKey}-catalogue`,
    image: publishImages ? remoteImages[0] ?? PLACEHOLDER : PLACEHOLDER,
    hoverImage: publishImages ? remoteImages[1] ?? null : null,
    gallery: publishImages ? remoteImages.slice(1).join(',') : '',
    imageStatus: publishImages ? 'LICENSED' : 'RIGHTS_REVIEW',
    badge: null,
    rating: 0,
    reviewCount: 0,
    stock: 0,
    stockKnown: false,
    stockUnlimited: true,
    availability: 'inStock',
    isBestSeller: false,
    isNew: false,
    featured: odem && category.slug === 'painel-ripado',
    materials: material,
    dimensions: dimensionOf(product, description),
    weight: null,
    care: null,
    color: colourOf(product),
    shippingClass: shippingClass(category.slug, product.title || ''),
    variants: mappedVariants,
    brand: product.vendor?.trim() || (odem ? 'ODEM' : 'WoodUpp'),
    manufacturer,
    electrical,
    battery,
    complianceStatus: 'PENDING_REVIEW',
    reviewMode: 'live',
    documentationStatus: 'PENDING',
    safetyJson: JSON.stringify({
      manufacturerName: manufacturer,
      productIdentifier: sku,
      supplierProductId: id,
      sourceUrl,
      warnings: [],
      safetyInstructions: [],
      complianceNote: 'Dados de catálogo do fornecedor importados; documentação técnica/compliance exige aprovação E-com.casa antes da venda. Fabricação direta sem limite de stock, conforme política comercial.',
    }),
    requiresComplianceReview: true,
    isDemo: false,
    supplierKey,
    supplierProductId: id,
    mediaRights,
    sourceResearchId: `partner:${supplierKey}:${id}`,
    sourceDomain: new URL(sourceOrigin).hostname,
    sourceUrl,
    sourceImageUrls: remoteImages,
    sortOrder: index,
    createdAt: product.published_at || product.created_at || new Date().toISOString(),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const products: PartnerProduct[] = [];
  const categoryMap = new Map<string, Category>();
  const usedSkus = new Set<string>();
  const sourceCounts: Record<string, number> = {};

  for (const collection of ODEM) {
    const endpoint = `/collections/${collection.handle}/products.json`;
    const rows = await fetchProducts('https://odem.pt', endpoint);
    sourceCounts[`odem:${collection.handle}`] = rows.length;
    categoryMap.set(collection.slug, {
      id: `category-shop-${collection.slug}`,
      slug: collection.slug,
      name: collection.name,
      type: 'shop',
      image: null,
      subtitle: collection.subtitle,
      sortOrder: categoryMap.size + 1,
    });
    for (const row of rows) products.push(normalize('odem', row, collection, products.length, usedSkus));
    await sleep(DELAY_MS);
  }

  const woodUppRows = await fetchProducts('https://woodupp.pt', '/products.json');
  sourceCounts['woodupp:products'] = woodUppRows.length;
  for (const row of woodUppRows) {
    const category = woodUppCategory(row);
    if (!categoryMap.has(category.slug)) {
      categoryMap.set(category.slug, {
        id: `category-shop-${category.slug}`,
        slug: category.slug,
        name: category.name,
        type: 'shop',
        image: null,
        subtitle: category.subtitle,
        sortOrder: categoryMap.size + 1,
      });
    }
    products.push(normalize('woodupp', row, category, products.length, usedSkus));
  }

  // Keep the complete intended shop taxonomy visible. Categories without a
  // current partner product intentionally return zero results instead of mocks.
  for (const [slug, name, subtitle] of [...WOODUPP_CATEGORIES, ...EMPTY_CATEGORIES]) {
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

  const deduped = [...new Map(products.map((product) => [`${product.supplierKey}:${product.supplierProductId}`, product])).values()];
  const odemCount = deduped.filter((product) => product.supplierKey === 'odem').length;
  const woodUppCount = deduped.filter((product) => product.supplierKey === 'woodupp').length;

  if (odemCount < 40) throw new Error(`Safety stop: expected at least 40 ODEM products, got ${odemCount}`);
  if (woodUppCount < 200) throw new Error(`Safety stop: expected at least 200 WoodUpp products, got ${woodUppCount}`);
  if (deduped.length < 240) throw new Error(`Safety stop: catalogue unexpectedly small (${deduped.length})`);
  if (deduped.some((product) => product.isDemo)) throw new Error('Safety stop: demo product in partner snapshot.');
  if (deduped.some((product) => product.mediaRights === 'UNCONFIRMED' && product.image !== PLACEHOLDER)) {
    throw new Error('Safety stop: unconfirmed media rights leaked into storefront image fields.');
  }

  // Use the first licensed image in each populated category where possible.
  for (const category of categoryMap.values()) {
    const first = deduped.find((product) => product.categorySlug === category.slug && product.image !== PLACEHOLDER);
    if (first) category.image = first.image;
  }

  const generatedAt = new Date().toISOString();
  const categories = [...categoryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const odemCategoryCounts = Object.fromEntries(ODEM.map((entry) => [entry.slug, deduped.filter((product) => product.supplierKey === 'odem' && product.categorySlug === entry.slug).length]));
  const woodUppCategoryCounts = Object.fromEntries(WOODUPP_CATEGORIES.map(([slug]) => [slug, deduped.filter((product) => product.supplierKey === 'woodupp' && product.categorySlug === slug).length]));
  const report = {
    generatedAt,
    totalProducts: deduped.length,
    odemProducts: odemCount,
    woodUppProducts: woodUppCount,
    odemCategoryCounts,
    woodUppCategoryCounts,
    sourceCounts,
    exactStockAvailable: false,
    saleability: 'BLOCKED_PENDING_STOCK_AND_COMPLIANCE',
    media: {
      odem: 'PARTNER_CONFIRMED_BY_MERCHANT',
      woodupp: 'UNCONFIRMED_PLACEHOLDER_ONLY',
    },
  };
  const catalogue = {
    generatedAt,
    mode: 'partner-production-staging',
    categories,
    subcategories: [],
    sourceCounts,
    note: 'Real ODEM/WoodUpp supplier catalogue snapshot. Historic mock products are not mixed into this snapshot. Exact inventory and compliance/documentation must be approved before checkout.',
  };

  await Promise.all([
    writeFile(path.join(OUT_DIR, 'generated-provider-products.json'), `${JSON.stringify(deduped, null, 2)}\n`, 'utf8'),
    writeFile(path.join(OUT_DIR, 'generated-provider-catalog.json'), `${JSON.stringify(catalogue, null, 2)}\n`, 'utf8'),
    writeFile(path.join(OUT_DIR, 'provider-sync-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  ]);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
