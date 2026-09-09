// ============================================================
// E-com.casa — Catalog metadata + bundles + relations
// (written to /data/catalog/generated-catalog.json etc.)
// ============================================================

export const CATEGORIES: Array<{ slug: string; name: string; type: 'space' | 'style' | 'collection' | 'shop'; image: string; subtitle?: string }> = [
  // Spaces
  { slug: 'living-room', name: 'Living Room', type: 'space', image: '/images/space-living-room.jpg' },
  { slug: 'bedroom', name: 'Bedroom', type: 'space', image: '/images/space-bedroom.jpg' },
  { slug: 'kitchen', name: 'Kitchen', type: 'space', image: '/images/space-kitchen.jpg' },
  { slug: 'bathroom', name: 'Bathroom', type: 'space', image: '/images/space-bathroom.jpg' },
  { slug: 'garden', name: 'Garden', type: 'space', image: '/images/space-garden.jpg' },
  { slug: 'balcony', name: 'Balcony', type: 'space', image: '/images/space-balcony.jpg' },
  { slug: 'home-office', name: 'Home Office', type: 'space', image: '/images/space-home-office.jpg' },
  // Styles
  { slug: 'warm-minimal', name: 'Warm Minimal', type: 'style', image: '/images/style-warm-minimal.jpg' },
  { slug: 'natural', name: 'Natural', type: 'style', image: '/images/style-natural.jpg' },
  { slug: 'modern', name: 'Modern', type: 'style', image: '/images/style-modern.jpg' },
  { slug: 'japandi', name: 'Japandi', type: 'style', image: '/images/style-japandi.jpg' },
  { slug: 'organic', name: 'Organic', type: 'style', image: '/images/style-organic.jpg' },
  { slug: 'neo-deco', name: 'Neo Deco', type: 'style', image: '/images/style-neo-deco.jpg' },
  { slug: 'mediterranean', name: 'Mediterranean', type: 'style', image: '/images/style-mediterranean.jpg' },
  // Shop categories
  { slug: 'lighting', name: 'Lighting', type: 'shop', image: '/images/collection-mood-lighting.jpg', subtitle: 'Mood lighting, pendants & portable glow' },
  { slug: 'wall-panels', name: 'Wall Panels', type: 'shop', image: '/images/collection-wall-makeover.jpg', subtitle: 'Slatted, fluted & decorative panels' },
  { slug: 'decoration', name: 'Interior Decoration', type: 'shop', image: '/images/product-ceramic-vase-set.jpg', subtitle: 'Mirrors, vases, art & textiles' },
  { slug: 'garden', name: 'Garden', type: 'shop', image: '/images/space-garden.jpg', subtitle: 'Lanterns, fire pits & garden living' },
  { slug: 'outdoor', name: 'Outdoor Living', type: 'shop', image: '/images/product-outdoor-sofa.jpg', subtitle: 'Furniture, parasols & outdoor rugs' },
  { slug: 'planters', name: 'Planters', type: 'shop', image: '/images/product-palm-planter.jpg', subtitle: 'Pots, towers & grow bags' },
  { slug: 'outdoor-privacy', name: 'Outdoor Privacy', type: 'shop', image: '/images/collection-balcony-escape.jpg', subtitle: 'Screens, hedges & reeds' },
  { slug: 'organisation', name: 'Organisation', type: 'shop', image: '/images/product-seagrass-basket.jpg', subtitle: 'Baskets, shelves & wardrobe calm' },
  { slug: 'kitchen-dining', name: 'Kitchen & Dining', type: 'shop', image: '/images/space-kitchen.jpg', subtitle: 'Boards, stoneware & storage' },
  { slug: 'gadgets-smart-home', name: 'Gadgets & Smart Home', type: 'shop', image: '/images/collection-mood-lighting.jpg', subtitle: 'Smart light, air & plugs' },
  { slug: 'accessories', name: 'Accessories', type: 'shop', image: '/images/product-ceramic-planter.jpg', subtitle: 'Doormats, misters & finishing touches' },
];

export const SUBCATEGORIES: Array<{ slug: string; name: string; parent: string }> = [
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
];

export const BUNDLES: Array<{
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  productSlugs: string[];
  image: string;
}> = [
  {
    slug: 'balcony-escape-set',
    name: 'Balcony Escape Set',
    subtitle: 'Bistro mornings · glow evenings',
    description:
      'A complete balcony refresh: bistro seating, a railing planter of summer colour, solar glow for after dark and a soft reed screen for privacy. Demo bundle — shop the pieces individually.',
    productSlugs: ['cafe-bistro-set', 'railing-planter-box', 'garden-string-lights', 'reed-balcony-screen'],
    image: '/images/collection-balcony-escape.jpg',
  },
  {
    slug: 'garden-glow-set',
    name: 'Garden Glow Set',
    subtitle: 'Warm light for long evenings',
    description:
      'Layer the garden after sunset: festoon light overhead, solar lanterns on the table, path stakes along the border and a flame torch for real warmth. Demo bundle — shop the pieces individually.',
    productSlugs: ['festoon-bulb-set', 'solar-cascade-lantern', 'solar-path-stakes', 'ember-garden-torch'],
    image: '/images/collection-garden-glow.jpg',
  },
  {
    slug: 'wall-makeover-set',
    name: 'Wall Makeover Set',
    subtitle: 'From flat wall to feature wall',
    description:
      'The transformation kit: oak slat panels, warm uplight for evening texture, a floating shelf duo and a styled vase trio to finish. Demo bundle — shop the pieces individually.',
    productSlugs: ['warm-oak-slat-panel', 'wall-washer-uplight', 'oak-floating-shelf-duo', 'ceramic-vase-trio'],
    image: '/images/collection-wall-makeover.jpg',
  },
  {
    slug: 'warm-minimal-starter-set',
    name: 'Warm Minimal Starter Set',
    subtitle: 'Calm, texture and light',
    description:
      'First steps into the E-com.casa look: linen cushions, a chunky throw, the ceramic table lamp and an arched mirror to double the daylight. Demo bundle — shop the pieces individually.',
    productSlugs: ['linen-cushion-set', 'chunky-knit-throw', 'ceramic-glow-table-lamp', 'arched-wall-mirror'],
    image: '/images/collection-mood-lighting.jpg',
  },
  {
    slug: 'outdoor-evening-set',
    name: 'Outdoor Evening Set',
    subtitle: 'Lounge, warm, glow',
    description:
      'Set the terrace for the night: floor cushions for lounge seating, a fire bowl for warmth, an amber globe for the border and a garland for the pergola. Demo bundle — shop the pieces individually.',
    productSlugs: ['outdoor-cushion-waterproof', 'fire-pit-bowl', 'globe-solar-stake-amber', 'solar-lantern-garland'],
    image: '/images/collection-garden-glow.jpg',
  },
  {
    slug: 'small-space-refresh-set',
    name: 'Small Space Refresh Set',
    subtitle: 'Clever pieces for compact rooms',
    description:
      'Big ideas for small rooms: a ladder shelf that climbs instead of spreads, a storage pouf, a stackable herb tower and a hanging planter to free the surfaces. Demo bundle — shop the pieces individually.',
    productSlugs: ['ladder-shelf-4tier', 'storage-ottoman-pouf', 'stackable-herb-tower', 'hanging-macrame-planter'],
    image: '/images/collection-balcony-escape.jpg',
  },
];

/** Example relational merchandising documented as an artifact. */
export const RELATION_EXAMPLES = [
  { type: 'COMPLETE_THE_LOOK', anchor: 'warm-oak-slat-panel', with: ['cordless-glow-portable-lamp', 'arched-wall-mirror', 'ceramic-vase-trio', 'oak-floating-shelf-duo'] },
  { type: 'COMPLETE_THE_LOOK', anchor: 'glow-orb-solar', with: ['solar-cascade-lantern', 'ribbed-stone-planter', 'slatted-privacy-screen', 'outdoor-cushion-waterproof'] },
  { type: 'SAME_COLLECTION', note: 'Products sharing collectionSlugs are related via the recommendations engine (see src/lib/catalog/recommendations.ts).' },
  { type: 'SAME_SPACE', note: 'Products sharing spaceSlugs are related via the recommendations engine.' },
  { type: 'CROSS_SELL', note: 'Cart cross-sell computed from category diversity + shared spaces (see getCrossSell).' },
];
