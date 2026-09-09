// ============================================================
// E-com.casa — Category, space, style & collection mapping
// ------------------------------------------------------------
// Maps source categories/signals into the E-com.casa taxonomy.
// ============================================================

import type { NormalizedCandidate } from './normalizer';

/** E-com.casa shop taxonomy (required + future-ready). */
export const ECOM_TAXONOMY = {
  shops: [
    { slug: 'lighting', name: 'Lighting' },
    { slug: 'wall-panels', name: 'Wall Panels' },
    { slug: 'decoration', name: 'Interior Decoration' },
    { slug: 'garden', name: 'Garden' },
    { slug: 'outdoor', name: 'Outdoor Living' },
    { slug: 'planters', name: 'Planters' },
    { slug: 'outdoor-privacy', name: 'Outdoor Privacy' },
    { slug: 'organisation', name: 'Organisation' },
    { slug: 'kitchen-dining', name: 'Kitchen & Dining' },
    { slug: 'gadgets-smart-home', name: 'Gadgets & Smart Home' },
    { slug: 'accessories', name: 'Accessories' },
  ],
  subcategories: [
    { slug: 'wood-slat-panels', name: 'Wood Slat Panels', parent: 'wall-panels' },
    { slug: 'decorative-panels', name: 'Decorative Panels', parent: 'wall-panels' },
    { slug: 'mirrors', name: 'Mirrors', parent: 'decoration' },
    { slug: 'led-lighting', name: 'LED Lighting', parent: 'lighting' },
    { slug: 'portable-lighting', name: 'Portable Lighting', parent: 'lighting' },
    { slug: 'outdoor-lighting', name: 'Outdoor Lighting', parent: 'lighting' },
    { slug: 'pots', name: 'Pots', parent: 'planters' },
    { slug: 'lanterns', name: 'Lanterns', parent: 'garden' },
    { slug: 'garden-decoration', name: 'Garden Decoration', parent: 'garden' },
    { slug: 'outdoor-furniture', name: 'Outdoor Furniture', parent: 'outdoor' },
    { slug: 'privacy-screens', name: 'Privacy Screens', parent: 'outdoor-privacy' },
  ],
  futureReady: ['Bathroom', 'Home Office', 'Textiles', 'Rugs', 'Furniture', 'Seasonal'],
} as const;

export interface CatalogAssignment {
  category: string;
  subcategories: string[];
  spaces: string[];
  styles: string[];
  collections: string[];
}

const CATEGORY_SIGNALS: Array<{ category: string; subs: string[]; re: RegExp }> = [
  { category: 'wall-panels', subs: ['wood-slat-panels'], re: /slat|slatted|wall panel|acoustic panel|cladding|lamella/i },
  { category: 'wall-panels', subs: ['decorative-panels'], re: /3d panel|wall cladding|decorative panel/i },
  { category: 'lighting', subs: ['outdoor-lighting'], re: /outdoor (light|lamp|wall light|bollard|spot)|solar (light|lamp|lantern)|garden light/i },
  { category: 'lighting', subs: ['portable-lighting'], re: /portable (lamp|light)|table lamp|desk lamp|cordless lamp|rechargeable lamp|floor lamp/i },
  { category: 'lighting', subs: ['led-lighting'], re: /led|light strip|strip light|neon|smart (light|bulb)|pendant|chandelier|ceiling light|wall light|lamp/i },
  { category: 'planters', subs: ['pots'], re: /planter|plant pot|flower ?pot|pot\b|jardiniere|maceta|macetero|vaso pianta/i },
  { category: 'garden', subs: ['lanterns'], re: /lantern|laterne|farol|wind light/i },
  { category: 'garden', subs: ['garden-decoration'], re: /garden (decor|ornament|torch|stake)|wind chime|bird feeder|fire ?pit|fire bowl|globe|solar orb/i },
  { category: 'outdoor', subs: ['outdoor-furniture'], re: /outdoor (sofa|chair|table|bench|lounge)|garden furniture|bistro set|sun lounger|parasol|hammock|daybed/i },
  { category: 'outdoor-privacy', subs: ['privacy-screens'], re: /privacy (screen|panel|fence)|balcony screen|garden screen|trellis|artificial hedge|fence panel/i },
  { category: 'decoration', subs: ['mirrors'], re: /mirror|espejo|spiegel|miroir/i },
  { category: 'organisation', subs: [], re: /basket|storage|organiser|organizer|shelf|hooks?|rack|box\b|wardrobe organi/i },
  { category: 'kitchen-dining', subs: [], re: /serving board|dining|bowl\b|mug|plate|kitchen|bar stool|bread bin|storage jar|cutting board|tableware|carafe/i },
  { category: 'gadgets-smart-home', subs: [], re: /smart (plug|home|speaker|light strip|sensor)|air (purifier|humidifier)|diffuser|robot vacuum|gadget/i },
  { category: 'accessories', subs: [], re: /cushion|throw|doormat|vase|tray|candle|clock|photo frame|bookend|sculpture|incense/i },
  { category: 'decoration', subs: [], re: /wall (art|decor|decoration)|print|poster|sculpture|decoration|decor/i },
];

const SPACE_SIGNALS: Array<{ space: string; re: RegExp }> = [
  { space: 'living-room', re: /living room|sofa|lounge|loungezimmer/i },
  { space: 'bedroom', re: /bedroom|bed side|nightstand|schlafzimmer/i },
  { space: 'kitchen', re: /kitchen|kuche|cocina|cuisine/i },
  { space: 'bathroom', re: /bathroom|badezimmer/i },
  { space: 'garden', re: /garden|garten|jardin|giardino/i },
  { space: 'balcony', re: /balcony|balkon|balcon/i },
  { space: 'terrace', re: /terrace|terrasse|terrazza/i },
  { space: 'patio', re: /patio/i },
  { space: 'home-office', re: /home office|desk|office|arbeit(s)?zimmer/i },
  { space: 'entrance', re: /entrance|hallway|hall\b|flur|entry/i },
  { space: 'dining', re: /dining|esszimmer|salle à manger/i },
  { space: 'outdoor-lounge', re: /outdoor lounge|outdoor sofa|lounge set/i },
];

const STYLE_SIGNALS: Array<{ style: string; re: RegExp }> = [
  { style: 'japandi', re: /japandi|japandi[- ]style|zen/i },
  { style: 'scandinavian', re: /scandinav|nordic|skandinav/i },
  { style: 'mediterranean', re: /mediterrane|coastal|riviera/i },
  { style: 'warm-minimal', re: /warm minimal|minimalist|minimal/i },
  { style: 'organic', re: /organic|natural shape|biomorphic/i },
  { style: 'neo-deco', re: /neo.?deco|art deco|deco\b/i },
  { style: 'rustic-modern', re: /rustic|country|farmhouse/i },
  { style: 'natural', re: /natural material|rattan|bamboo|seagrass|jute|woven/i },
  { style: 'modern', re: /modern|contemporary/i },
  { style: 'contemporary', re: /contemporary/i },
];

const COLLECTION_SIGNALS: Array<{ collection: string; re: RegExp }> = [
  { collection: 'wall-makeover', re: /wall panel|slat|wall makeover|3d panel|wall cladding/i },
  { collection: 'mood-lighting', re: /table lamp|ambient|portable lamp|mood|dim|candle/i },
  { collection: 'garden-glow', re: /solar|garden light|garden lantern|outdoor light|torch/i },
  { collection: 'balcony-escape', re: /balcony|bistro|small space outdoor/i },
  { collection: 'cosy-corner', re: /cushion|throw|blanket|cosy|cozy|armchair/i },
  { collection: 'natural-objects', re: /rattan|bamboo|seagrass|jute|wood|ceramic|woven/i },
  { collection: 'warm-oak', re: /oak|eiche/i },
  { collection: 'outdoor-living', re: /outdoor (sofa|chair|table|bench|lounge)|patio|terrace/i },
  { collection: 'small-spaces', re: /small space|compact|foldable|stackable|narrow/i },
  { collection: 'japandi-calm', re: /japandi|zen|minimal/i },
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

const DEFAULT_STYLES: string[] = ['modern', 'contemporary'];

export function assignCatalogFields(n: NormalizedCandidate): CatalogAssignment {
  const text = `${n.sourceProductName} ${n.sourceDescription ?? ''} ${n.sourceAttributes?.['category'] ?? ''}`;

  let category = 'decoration';
  let subs: string[] = [];
  for (const sig of CATEGORY_SIGNALS) {
    if (sig.re.test(text)) {
      category = sig.category;
      subs = sig.subs;
      break;
    }
  }
  if (n.normalized.categoryHint) {
    const hint = CATEGORY_SIGNALS.find((s) => s.re.test(n.normalized.categoryHint!));
    if (hint) {
      category = hint.category;
      subs = hint.subs;
    }
  }

  const spaces = SPACE_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.space);
  const finalSpaces = spaces.length > 0 ? spaces.slice(0, 3) : DEFAULT_SPACE_BY_CATEGORY[category] ?? ['living-room'];

  const styles = STYLE_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.style);
  const finalStyles = styles.length > 0 ? styles.slice(0, 3) : DEFAULT_STYLES;

  const collections = COLLECTION_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.collection).slice(0, 3);

  return { category, subcategories: subs, spaces: finalSpaces, styles: finalStyles, collections };
}
