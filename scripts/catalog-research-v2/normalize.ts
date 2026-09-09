// ============================================================
// E-com.casa — V2 normalization + taxonomy mapping
// ------------------------------------------------------------
// Normalizes extracted values (price, currency, dimensions,
// weight, material, colour) and maps source categories into the
// E-com.casa taxonomy (category / subcategory / spaces / styles /
// collections). Merchandising classification is allowed to be
// editorial; factual specifications are never invented (§20).
// ============================================================

import type { ExtractedPage, SpecRecord } from './extract';
import { toEur } from './config';

// ---------------- Price / currency ----------------

export interface NormalizedPrice {
  amount: number | null;
  currency: string;
  amountEur: number | null;
  salePriceEur: number | null;
  regularPriceEur: number | null;
}

export function normalizePrice(page: ExtractedPage, defaultCurrency: string): NormalizedPrice {
  const currency = (page.priceCurrency ?? defaultCurrency).toUpperCase();
  const amount = page.priceAmount ?? null;
  return {
    amount,
    currency,
    amountEur: amount !== null ? toEur(amount, currency) : null,
    salePriceEur: page.salePriceAmount !== undefined ? toEur(page.salePriceAmount, currency) : null,
    regularPriceEur: page.regularPriceAmount !== undefined ? toEur(page.regularPriceAmount, currency) : null,
  };
}

// ---------------- Dimensions / weight ----------------

export interface NormalizedDims {
  text: string | null;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  diameterCm?: number;
}

function toCm(v: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('mm')) return v / 10;
  if (u.startsWith('m') && !u.startsWith('mm')) return v * 100;
  if (u.includes('in') || u === '"' || u.includes('inch')) return v * 2.54;
  return v; // cm default
}

export function normalizeDimensions(page: ExtractedPage): NormalizedDims {
  const sources: string[] = [];
  if (page.dimensions) sources.push(page.dimensions);
  const dimSpec = page.specs.find((s) => /dimension|size|measure|afmeting|masse|maße/i.test(s.key));
  if (dimSpec) sources.push(`${dimSpec.key}: ${dimSpec.sourceValue}`);
  for (const b of page.bulletPoints ?? []) {
    if (/\d+\s?[x×]\s?\d+/.test(b)) sources.push(b);
  }
  const text = sources.join(' ');
  if (!text) return { text: null };

  const dims: NormalizedDims = { text: (page.dimensions ?? dimSpec?.sourceValue ?? null)?.slice(0, 160) ?? null };

  const comboRe = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")?\s*[x×hwd]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")?(?:\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|")?)?/gi;
  const combo = text.match(comboRe);
  if (combo) {
    const parts = [...combo[0].matchAll(/(\d+(?:[.,]\d+)?)/g)].map((mm) => parseFloat(mm[1].replace(',', '.')));
    const units = [...combo[0].matchAll(/(mm|cm|m\b|in|")/gi)].map((u) => u[1]);
    const unit = units[0] ?? 'cm';
    const vals = parts.map((p) => Math.round(toCm(p, unit) * 10) / 10);
    if (vals.length >= 2) {
      const sorted = [...vals].sort((a, b) => b - a); // L ≥ W ≥ H convention
      dims.lengthCm = sorted[0];
      dims.widthCm = sorted[1];
      if (sorted[2] !== undefined) dims.heightCm = sorted[2];
      if (!dims.text) dims.text = combo[0];
    }
  }
  const diaRe = /[⌀Øø]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i;
  const dia = text.match(diaRe);
  if (dia) {
    dims.diameterCm = Math.round(toCm(parseFloat(dia[1].replace(',', '.')), dia[2] ?? 'cm') * 10) / 10;
  }
  const hRe = /(?:height|höhe|hauteur|alto|h)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i;
  const hm = text.match(hRe);
  if (hm && dims.heightCm === undefined) {
    dims.heightCm = Math.round(toCm(parseFloat(hm[1].replace(',', '.')), hm[2] ?? 'cm') * 10) / 10;
  }
  return dims;
}

export function normalizeWeight(page: ExtractedPage): string | null {
  if (page.weight) return page.weight.slice(0, 40);
  const spec = page.specs.find((s) => /weight|gewicht|poids|peso/i.test(s.key));
  if (spec) {
    const m = spec.sourceValue.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|lbs?)\b/i);
    if (m) return `${m[1].replace(',', '.')} ${m[2].toLowerCase()}`;
  }
  return null; // never invented (§20)
}

// ---------------- Material / colour ----------------

const MATERIAL_MAP: Array<[RegExp, string]> = [
  [/solid oak|\boak\b|eiche|chêne|carvalho/i, 'Oak'],
  [/walnut|nogal|noyer|nogueira/i, 'Walnut'],
  [/pine|pinho|kiefer/i, 'Pine'],
  [/acacia/i, 'Acacia'],
  [/teak|teca/i, 'Teak'],
  [/bamboo|bambu/i, 'Bamboo'],
  [/rattan|rotin|rotan/i, 'Rattan'],
  [/seagrass|zeegras/i, 'Seagrass'],
  [/jute/i, 'Jute'],
  [/wicker|woven willow/i, 'Wicker'],
  [/ceramic|cerámica|keramik|céramique/i, 'Ceramic'],
  [/stoneware|steingut/i, 'Stoneware'],
  [/porcelain|porzellan|porcelana/i, 'Porcelain'],
  [/terracotta/i, 'Terracotta'],
  [/concrete|beton|cemento/i, 'Concrete'],
  [/marble|marmor|mármol|marbre|mármore/i, 'Marble'],
  [/travertine/i, 'Travertine'],
  [/glass|vidro|glas|verre/i, 'Glass'],
  [/mirror/i, 'Mirror'],
  [/steel|stainless|edelstahl|acier|aço/i, 'Steel'],
  [/aluminium|aluminum|aluminio|aluminium/i, 'Aluminium'],
  [/iron|fer\b|metalu/i, 'Iron'],
  [/brass|messing|latão|laiton/i, 'Brass'],
  [/copper|kupfer|cobre/i, 'Copper'],
  [/polyrattan|poly rattan/i, 'Polyrattan'],
  [/plastic|kunststoff|plástico|plastique/i, 'Plastic'],
  [/velvet|velours|veludo/i, 'Velvet'],
  [/boucl|boucle/i, 'Bouclé'],
  [/linen|linho|leinen|lin\b/i, 'Linen'],
  [/cotton|algodão|baumwolle|coton/i, 'Cotton'],
  [/wool|lã|wolle|laine/i, 'Wool'],
  [/paper|papier|papel|rice paper/i, 'Paper'],
  [/mdf|plywood|multiplex/i, 'Engineered wood'],
  [/wood|hout|holz|madera|legno|bois|madeira/i, 'Wood'],
  [/metal|metall|métal|metal/i, 'Metal'],
  [/fabric|textile|stof|tissu|stoff/i, 'Fabric'],
  [/stone|stein|piedra|pierre|pedra/i, 'Stone'],
  [/rope|seil|corde|corda/i, 'Rope'],
  [/clay/i, 'Clay'],
  [/granite|granito/i, 'Granite'],
];

export function normalizeMaterial(page: ExtractedPage): string | null {
  const candidates: string[] = [];
  if (page.material) candidates.push(page.material);
  const spec = page.specs.find((s) => /material|matériau|werkstoff|materiaal/i.test(s.key));
  if (spec) candidates.push(spec.sourceValue);
  if (page.fullDescription) candidates.push(page.fullDescription.slice(0, 1200));
  const raw = candidates.join(' | ');
  if (!raw) return null;
  for (const [re, normalized] of MATERIAL_MAP) {
    if (re.test(raw)) return normalized;
  }
  // keep explicit raw material text if it looks like a real material label
  if (page.material && page.material.length < 60) return page.material;
  const specFirst = page.specs.find((s) => /material/i.test(s.key));
  if (specFirst && specFirst.sourceValue.length < 60) return specFirst.sourceValue;
  return null;
}

const COLOUR_MAP: Array<[RegExp, string]> = [
  [/black|schwarz|noir|negro|preto/i, 'Black'],
  [/anthracite|antracite/i, 'Anthracite'],
  [/white|weiß|weiss|blanc|blanco|branco/i, 'White'],
  [/cream|creme|crème|crema/i, 'Cream'],
  [/beige/i, 'Beige'],
  [/sand/i, 'Sand'],
  [/taupe/i, 'Taupe'],
  [/grey|gray|grau|gris|cinza/i, 'Grey'],
  [/green|grün|vert|verde/i, 'Green'],
  [/olive/i, 'Olive'],
  [/sage/i, 'Sage'],
  [/blue|blau|bleu|azul/i, 'Blue'],
  [/navy/i, 'Navy'],
  [/teal|petrol/i, 'Teal'],
  [/red|rot|rouge|rojo|vermelho/i, 'Red'],
  [/terracotta/i, 'Terracotta'],
  [/rust|roest/i, 'Rust'],
  [/orange|laranja/i, 'Orange'],
  [/yellow|gelb|jaune|amarillo|amarelo/i, 'Yellow'],
  [/mustard/i, 'Mustard'],
  [/pink|rosa|rose/i, 'Pink'],
  [/purple|paars|violet|lila/i, 'Purple'],
  [/brown|braun|brun|marrón|marron|castanho|marrom/i, 'Brown'],
  [/walnut|nogal|noyer/i, 'Walnut'],
  [/gold|doré|dorado|dourado/i, 'Gold'],
  [/brass|messing/i, 'Brass'],
  [/silver|silber|argent|prata/i, 'Silver'],
  [/natural|naturel|naturbelassen/i, 'Natural'],
  [/oak|eiche|chêne/i, 'Oak'],
];

export function normalizeColour(page: ExtractedPage): string | null {
  const candidates: string[] = [];
  if (page.colour) candidates.push(page.colour);
  const spec = page.specs.find((s) => /colou?r|farbe|couleur|kleur|cor\b/i.test(s.key));
  if (spec) candidates.push(spec.sourceValue);
  if (page.title) candidates.push(page.title);
  if (page.subtitle) candidates.push(page.subtitle);
  const raw = candidates.join(' | ');
  if (!raw) return null;
  for (const [re, normalized] of COLOUR_MAP) {
    if (re.test(raw)) return normalized;
  }
  return null;
}

// ---------------- Specs normalization (§19) ----------------

const KEY_NORMALIZERS: Array<[RegExp, string]> = [
  [/material|matériau|werkstoff|materiaal/i, 'material'],
  [/colou?r|farbe|couleur|kleur/i, 'colour'],
  [/dimension|size|measure|afmeting|maße|medidas/i, 'dimensions'],
  [/weight|gewicht|poids|peso/i, 'weight'],
  [/height|höhe|hauteur|alto|hoogte/i, 'height'],
  [/width|breite|largeur|ancho|breedte/i, 'width'],
  [/length|länge|longueur|largo|lengte/i, 'length'],
  [/depth|tiefe|profondeur|fondo|diepte/i, 'depth'],
  [/diameter|durchmesser|diámetro/i, 'diameter'],
  [/power|wattage|leistung/i, 'power'],
  [/voltage|spannung|tensión|tensao|volt/i, 'voltage'],
  [/lumen|lichtstrom/i, 'lumens'],
  [/kelvin|colour temperature|farbtemperatur/i, 'colourTemperature'],
  [/ip ?(rating|code)|schutzart/i, 'ipRating'],
  [/energy|energie/i, 'energyClass'],
  [/battery|batterie|batterij/i, 'battery'],
  [/origin|herkunft|origine|ursprung/i, 'countryOfOrigin'],
  [/assembly|montage|aufbau|montagem/i, 'assembly'],
];

export function normalizeSpecs(specs: SpecRecord[]): SpecRecord[] {
  return specs.map((s) => {
    for (const [re, key] of KEY_NORMALIZERS) {
      if (re.test(s.key)) return { ...s, normalizedKey: key, normalizedValue: s.sourceValue.slice(0, 120) };
    }
    return s;
  });
}

// ---------------- Electrical / outdoor detection ----------------

const ELECTRICAL_RE = /led|lamp|luminaire|light(?:ing)?|plug|socket|cable|cord|transformer|voltage|volt\b|watt|mains|rechargeable|usb\b|batter(?:y|ie)|lampe|leuchte|lampara|luminaria/i;
const BATTERY_RE = /batter(?:y|ies|ie)|rechargeable|akku|cordless|akumulator|solar/i;

export function detectElectrical(page: ExtractedPage): { electrical: boolean; battery: boolean; specs: Record<string, string> } {
  const text = [page.title, page.fullDescription?.slice(0, 1500), page.category, page.bulletPoints?.join(' '), page.specs.map((s) => `${s.key} ${s.sourceValue}`).join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const electrical = ELECTRICAL_RE.test(text);
  const battery = BATTERY_RE.test(text);
  const specs: Record<string, string> = {};
  for (const s of normalizeSpecs(page.specs)) {
    if (s.normalizedKey && ['power', 'voltage', 'lumens', 'colourTemperature', 'ipRating', 'energyClass'].includes(s.normalizedKey)) {
      specs[s.normalizedKey] = s.normalizedValue ?? s.sourceValue;
    }
  }
  return { electrical, battery, specs };
}

const OUTDOOR_RE = /outdoor|garden|garten|jardin|exterior|patio|terrace|balkon|balcony|weatherproof|uv.?resist|frost|waterproof|ip4[45678]/i;

export function detectOutdoorUse(page: ExtractedPage): boolean {
  const text = [page.title, page.category, page.breadcrumbs?.join(' '), page.fullDescription?.slice(0, 800), page.specs.map((s) => `${s.key} ${s.sourceValue}`).join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return OUTDOOR_RE.test(text);
}

// ---------------- Taxonomy mapping (§24–§27) ----------------

import type { CatalogAssignment } from './taxonomy-types';

const CATEGORY_SIGNALS: Array<{ category: string; subs: string[]; re: RegExp }> = [
  { category: 'wall-panels', subs: ['wood-slat-panels'], re: /slat|slatted|lamell|wall panel|acoustic panel|cladding|panele/i },
  { category: 'wall-panels', subs: ['decorative-panels'], re: /3d panel|wall cladding|decorative panel|fluted panel/i },
  { category: 'lighting', subs: ['outdoor-lighting'], re: /outdoor (light|lamp|wall light|bollard|spot|lantern)|solar (light|lamp|lantern|torch)|garden light|buitenlamp/i },
  { category: 'lighting', subs: ['portable-lighting'], re: /portable (lamp|light)|table lamp|desk lamp|cordless lamp|rechargeable lamp|floor lamp|bordslampa/i },
  { category: 'lighting', subs: ['led-lighting'], re: /led|light strip|strip light|neon|smart (light|bulb)|pendant|chandelier|ceiling light|wall light|lamp|leuchte|lampe/i },
  { category: 'planters', subs: ['pots'], re: /planter|plant pot|flower ?pot|flowerpot|\bpot\b|jardiniere|jardineira|maceta|macetero|bloempot/i },
  { category: 'garden', subs: ['lanterns'], re: /lantern|laterne|farol|wind light|photophore/i },
  { category: 'garden', subs: ['garden-decoration'], re: /garden (decor|ornament|torch|stake|globe)|wind chime|bird (feeder|bath)|fire ?pit|fire bowl|chiminea/i },
  { category: 'outdoor', subs: ['outdoor-furniture'], re: /outdoor (sofa|chair|table|bench|lounge|dining)|garden furniture|bistro set|sun lounger|parasol|hammock|daybed|loungemöbel/i },
  { category: 'outdoor-privacy', subs: ['privacy-screens'], re: /privacy (screen|panel|fence)|balcony screen|garden screen|trellis|artificial hedge|fence panel|sichtschutz/i },
  { category: 'decoration', subs: ['mirrors'], re: /mirror|espejo|spiegel|miroir|espelho/i },
  { category: 'organisation', subs: [], re: /basket|storage|organiser|organizer|shelf|shelving|hooks?|rack|\bbox\b|wardrobe organi|baskets?/i },
  { category: 'kitchen-dining', subs: [], re: /serving board|dining|bowl\b|mug|plate|kitchen|bar stool|bread bin|storage jar|cutting board|tableware|carafe|tray\b|servierbrett/i },
  { category: 'gadgets-smart-home', subs: [], re: /smart (plug|home|speaker|light strip|sensor|lamp)|air (purifier|humidifier)|diffuser|robot vacuum|gadget|projector/i },
  { category: 'accessories', subs: [], re: /cushion|throw|doormat|vase|candle|clock|photo frame|bookend|sculpture|incense|pillow|kissen|coussin/i },
  { category: 'decoration', subs: [], re: /wall (art|decor|decoration)|print|poster|sculpture|decoration|decor|ornament/i },
];

const SPACE_SIGNALS: Array<{ space: string; re: RegExp }> = [
  { space: 'living-room', re: /living room|sofa|lounge|wohnzimmer/i },
  { space: 'bedroom', re: /bedroom|bedside|nightstand|schlafzimmer/i },
  { space: 'kitchen', re: /kitchen|küche|cocina|cuisine/i },
  { space: 'bathroom', re: /bathroom|badezimmer/i },
  { space: 'garden', re: /garden|garten|jardin|giardino/i },
  { space: 'balcony', re: /balcony|balkon|balcão/i },
  { space: 'terrace', re: /terrace|terrasse|terrazza|terraço/i },
  { space: 'patio', re: /patio/i },
  { space: 'home-office', re: /home office|desk|office|arbeitszimmer/i },
  { space: 'entrance', re: /entrance|hallway|hall\b|flur|entry/i },
  { space: 'dining', re: /dining|esszimmer|salle à manger/i },
  { space: 'outdoor-lounge', re: /outdoor lounge|outdoor sofa|lounge set/i },
];

const STYLE_SIGNALS: Array<{ style: string; re: RegExp; confidence: number }> = [
  { style: 'japandi', re: /japandi|zen\b/i, confidence: 0.85 },
  { style: 'scandinavian', re: /scandinav|nordic|skandinav/i, confidence: 0.85 },
  { style: 'mediterranean', re: /mediterrane|coastal|riviera/i, confidence: 0.8 },
  { style: 'warm-minimal', re: /warm minimal|minimalist|minimal/i, confidence: 0.7 },
  { style: 'organic', re: /organic|natural shape|biomorphic|organic/i, confidence: 0.7 },
  { style: 'neo-deco', re: /neo.?deco|art deco/i, confidence: 0.85 },
  { style: 'rustic-modern', re: /rustic|country|farmhouse/i, confidence: 0.75 },
  { style: 'natural', re: /natural material|rattan|bamboo|seagrass|jute|woven/i, confidence: 0.8 },
  { style: 'modern', re: /modern(?!e)\b/i, confidence: 0.6 },
  { style: 'contemporary', re: /contemporary|zeitgenössisch/i, confidence: 0.7 },
];

const COLLECTION_SIGNALS: Array<{ collection: string; re: RegExp }> = [
  { collection: 'wall-makeover', re: /wall panel|slat|3d panel|wall cladding/i },
  { collection: 'mood-lighting', re: /table lamp|ambient|portable lamp|mood|dim|candle/i },
  { collection: 'garden-glow', re: /solar|garden light|garden lantern|outdoor light|torch/i },
  { collection: 'balcony-escape', re: /balcony|bistro|small space outdoor/i },
  { collection: 'cosy-corner', re: /cushion|throw|blanket|cosy|cozy|armchair/i },
  { collection: 'natural-objects', re: /rattan|bamboo|seagrass|jute|\bwood\b|ceramic|woven/i },
  { collection: 'warm-oak', re: /\boak\b|eiche/i },
  { collection: 'outdoor-living', re: /outdoor (sofa|chair|table|bench|lounge)|patio|terrace/i },
  { collection: 'small-spaces', re: /small space|compact|foldable|stackable|narrow/i },
  { collection: 'japandi-calm', re: /japandi|\bzen\b|minimal/i },
  { collection: 'mediterranean-garden', re: /mediterrane|terracotta|olive|coastal/i },
  { collection: 'modern-essentials', re: /modern|essential|everyday/i },
  { collection: 'weekend-refresh', re: /refresh|update|weekend/i },
  { collection: 'green-living', re: /planter|plant pot|herb|green/i },
  { collection: 'home-office', re: /desk|office|shelf organi/i },
  { collection: 'soft-neutrals', re: /beige|cream|sand|taupe|neutral/i },
  { collection: 'statement-pieces', re: /statement|sculptural|bold|oversized/i },
];

const DEFAULT_SPACE_BY_CATEGORY: Record<string, string[]> = {
  lighting: ['living-room', 'bedroom'],
  'wall-panels': ['living-room', 'bedroom'],
  decoration: ['living-room', 'entrance'],
  garden: ['garden'],
  outdoor: ['garden', 'terrace'],
  planters: ['garden', 'balcony', 'living-room'],
  'outdoor-privacy': ['balcony', 'garden', 'terrace'],
  organisation: ['entrance', 'bedroom', 'home-office'],
  'kitchen-dining': ['kitchen', 'dining'],
  'gadgets-smart-home': ['living-room', 'kitchen'],
  accessories: ['living-room', 'bedroom'],
};

const CATEGORY_FIT_HINT: Record<string, string[]> = {
  // markets where the category has high merchandising fit (editorial, NOT demand data — §64)
  lighting: ['PT', 'DE', 'FR', 'ES', 'IT', 'NL', 'UK'],
  'wall-panels': ['DE', 'NL', 'PT', 'FR', 'UK'],
  decoration: ['PT', 'FR', 'ES', 'IT', 'NL', 'UK', 'DE'],
  garden: ['PT', 'ES', 'FR', 'IT', 'UK', 'DE', 'NL'],
  outdoor: ['PT', 'ES', 'IT', 'FR', 'UK', 'DE', 'NL'],
  planters: ['PT', 'NL', 'DE', 'FR', 'ES', 'IT', 'UK'],
  'outdoor-privacy': ['NL', 'DE', 'PT', 'ES', 'FR', 'UK'],
  organisation: ['DE', 'NL', 'UK', 'FR', 'PT', 'ES', 'IT'],
  'kitchen-dining': ['FR', 'IT', 'PT', 'DE', 'ES', 'NL', 'UK'],
  'gadgets-smart-home': ['DE', 'UK', 'NL', 'FR', 'ES', 'IT', 'PT'],
  accessories: ['FR', 'PT', 'IT', 'DE', 'ES', 'NL', 'UK'],
};

export function mapCatalogFields(
  page: ExtractedPage,
  opts: { defaultCategory?: string },
): CatalogAssignment & { categoryConfidence: number } {
  const text = [page.title, page.subtitle, page.category, page.breadcrumbs?.join(' '), page.shortDescription, page.fullDescription?.slice(0, 600), page.bulletPoints?.slice(0, 4).join(' ')]
    .filter(Boolean)
    .join(' ');

  let category = opts.defaultCategory ?? 'decoration';
  let subs: string[] = [];
  let categoryConfidence = opts.defaultCategory ? 0.7 : 0.5;
  for (const sig of CATEGORY_SIGNALS) {
    if (sig.re.test(text)) {
      category = sig.category;
      subs = sig.subs;
      categoryConfidence = 0.85;
      break;
    }
  }
  if (page.breadcrumbs && page.breadcrumbs.length > 1) {
    const bcText = page.breadcrumbs.join(' ');
    const hint = CATEGORY_SIGNALS.find((s) => s.re.test(bcText));
    if (hint && categoryConfidence < 0.85) {
      category = hint.category;
      subs = hint.subs;
      categoryConfidence = 0.8;
    }
  }

  const spaces = SPACE_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.space);
  const finalSpaces = (spaces.length > 0 ? spaces : DEFAULT_SPACE_BY_CATEGORY[category] ?? ['living-room']).slice(0, 3);

  const styleMatches = STYLE_SIGNALS.filter((s) => s.re.test(text));
  const finalStyles = (styleMatches.length > 0 ? styleMatches.map((s) => s.style) : ['modern', 'contemporary']).slice(0, 3);
  const styleConfidence = styleMatches.length > 0 ? styleMatches[0].confidence : 0.4;

  const collections = COLLECTION_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.collection).slice(0, 3);

  const fitMarkets = CATEGORY_FIT_HINT[category] ?? ['PT', 'DE', 'FR', 'ES', 'IT', 'NL', 'UK'];
  const countryFit: Record<string, string> = {};
  for (const m of ['PT', 'FR', 'DE', 'ES', 'IT', 'NL', 'UK']) {
    const idx = fitMarkets.indexOf(m);
    countryFit[m] = idx === -1 ? 'LOW' : idx < 2 ? 'HIGH' : idx < 4 ? 'MEDIUM' : 'MEDIUM';
  }

  return { category, subcategories: subs, spaces: finalSpaces, styles: finalStyles, collections, categoryConfidence, styleConfidence, collectionsConfidence: collections.length > 0 ? 0.8 : 0.3, countryFit };
}

export function computeCountryFitJson(countryFit: Record<string, string>): string {
  return JSON.stringify(countryFit);
}
