import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const categories = [
  // Spaces
  { slug: 'living-room', name: 'Living Room', type: 'space', image: '/images/space-living-room.jpg', sortOrder: 1 },
  { slug: 'bedroom', name: 'Bedroom', type: 'space', image: '/images/space-bedroom.jpg', sortOrder: 2 },
  { slug: 'kitchen', name: 'Kitchen', type: 'space', image: '/images/space-kitchen.jpg', sortOrder: 3 },
  { slug: 'bathroom', name: 'Bathroom', type: 'space', image: '/images/space-bathroom.jpg', sortOrder: 4 },
  { slug: 'garden', name: 'Garden', type: 'space', image: '/images/space-garden.jpg', sortOrder: 5 },
  { slug: 'balcony', name: 'Balcony', type: 'space', image: '/images/space-balcony.jpg', sortOrder: 6 },
  { slug: 'home-office', name: 'Home Office', type: 'space', image: '/images/space-home-office.jpg', sortOrder: 7 },
  // Styles
  { slug: 'warm-minimal', name: 'Warm Minimal', type: 'style', image: '/images/style-warm-minimal.jpg', sortOrder: 1 },
  { slug: 'natural', name: 'Natural', type: 'style', image: '/images/style-natural.jpg', sortOrder: 2 },
  { slug: 'modern', name: 'Modern', type: 'style', image: '/images/style-modern.jpg', sortOrder: 3 },
  { slug: 'japandi', name: 'Japandi', type: 'style', image: '/images/style-japandi.jpg', sortOrder: 4 },
  { slug: 'organic', name: 'Organic', type: 'style', image: '/images/style-organic.jpg', sortOrder: 5 },
  { slug: 'neo-deco', name: 'Neo Deco', type: 'style', image: '/images/style-neo-deco.jpg', sortOrder: 6 },
  { slug: 'mediterranean', name: 'Mediterranean', type: 'style', image: '/images/style-mediterranean.jpg', sortOrder: 7 },
  // Shop categories
  { slug: 'wall-panels', name: 'Wall Panels', type: 'shop', image: '/images/collection-wall-makeover.jpg', sortOrder: 1 },
  { slug: 'lighting', name: 'Lighting', type: 'shop', image: '/images/collection-mood-lighting.jpg', sortOrder: 2 },
  { slug: 'garden', name: 'Garden', type: 'shop', image: '/images/space-garden.jpg', sortOrder: 3 },
  { slug: 'outdoor', name: 'Outdoor', type: 'shop', image: '/images/product-outdoor-sofa.jpg', sortOrder: 4 },
  { slug: 'decoration', name: 'Decoration', type: 'shop', image: '/images/product-ceramic-vase-set.jpg', sortOrder: 5 },
  { slug: 'organisation', name: 'Organisation', type: 'shop', image: '/images/product-seagrass-basket.jpg', sortOrder: 6 },
  { slug: 'interior', name: 'Interior', type: 'shop', image: '/images/space-living-room.jpg', sortOrder: 7 },
];

type SeedProduct = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: string;
  comparePrice?: string;
  categorySlug: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs?: string;
  image: string;
  badge?: string;
  rating: number;
  reviewCount: number;
  isBestSeller?: boolean;
  isNew?: boolean;
  featured?: boolean;
  materials: string;
  dimensions: string;
  care: string;
  color: string;
  electrical?: boolean;
};

const products: SeedProduct[] = [
  {
    slug: 'wood-slat-wall-panel-oak',
    name: 'Wood Slat Wall Panel (Oak)',
    subtitle: 'Natural Oak · 240 × 60 cm',
    description:
      'Transform any wall in minutes with our signature oak slat panel. Precision-milled vertical slats on a felt backing add warmth, depth and acoustic comfort to living rooms, hallways and bedrooms. Panels interlock seamlessly for a clean, continuous look — cut to size with a standard saw.',
    price: '49.90',
    categorySlug: 'wall-panels',
    spaceSlugs: 'living-room,bedroom,home-office',
    styleSlugs: 'warm-minimal,japandi,natural',
    collectionSlugs: 'wall-makeover',
    image: '/images/product-wood-slat-panel.jpg',
    badge: 'Bestseller',
    rating: 4.8,
    reviewCount: 1240,
    isBestSeller: true,
    featured: true,
    materials: 'Natural oak veneer slats, recycled PET acoustic felt backing',
    dimensions: '240 × 60 cm · 2.2 cm slat depth',
    care: 'Wipe with a dry microfibre cloth. Avoid direct water exposure.',
    color: 'Oak',
  },
  {
    slug: 'portable-led-table-lamp',
    name: 'Portable LED Table Lamp',
    subtitle: 'Cream · USB-C rechargeable',
    description:
      'A cordless glow you can carry anywhere. Three warmth settings, up to 30 hours of battery life and a soft-touch dimmer. From dinner tables to balconies — set the mood indoors and out.',
    price: '39.90',
    categorySlug: 'lighting',
    spaceSlugs: 'living-room,balcony,bedroom',
    styleSlugs: 'warm-minimal,organic,modern',
    collectionSlugs: 'mood-lighting',
    image: '/images/product-led-table-lamp.jpg',
    badge: 'Bestseller',
    rating: 4.7,
    reviewCount: 986,
    isBestSeller: true,
    featured: true,
    materials: 'Powder-coated steel, opal diffuser',
    dimensions: 'Ø 12 × 26 cm · 0.9 kg',
    care: 'Wipe with a soft dry cloth. IP44 — suitable for covered outdoor use.',
    color: 'Cream',
    electrical: true,
  },
  {
    slug: 'arched-wall-mirror',
    name: 'Arched Wall Mirror',
    subtitle: 'Brass frame · 60 × 90 cm',
    description:
      'A quiet statement. The softly arched silhouette and slim brass frame bring light, height and calm to any room. Hangs vertically or leans elegantly against the wall.',
    price: '79.90',
    categorySlug: 'decoration',
    spaceSlugs: 'living-room,bedroom,bathroom',
    styleSlugs: 'neo-deco,modern,warm-minimal',
    image: '/images/product-arched-mirror.jpg',
    rating: 4.6,
    reviewCount: 743,
    isBestSeller: true,
    featured: true,
    materials: 'Brass-finished alloy frame, 4 mm float glass',
    dimensions: '60 × 90 × 2.5 cm',
    care: 'Clean glass with standard glass cleaner; frame with dry cloth.',
    color: 'Brass',
  },
  {
    slug: 'ceramic-planter-set-of-2',
    name: 'Ceramic Planter (Set of 2)',
    subtitle: 'Ribbed cream · Ø 16 & 20 cm',
    description:
      'Hand-finished ribbed ceramics in a soft cream glaze. Each set includes two complementary sizes with drainage holes and matching saucers — ready for your greenest corner.',
    price: '34.90',
    categorySlug: 'garden',
    spaceSlugs: 'living-room,balcony,garden,bedroom',
    styleSlugs: 'organic,natural,mediterranean',
    image: '/images/product-ceramic-planter.jpg',
    badge: 'Set of 2',
    rating: 4.8,
    reviewCount: 682,
    isBestSeller: true,
    featured: true,
    materials: 'Glazed stoneware ceramic',
    dimensions: 'Ø 16 × 16 cm & Ø 20 × 20 cm',
    care: 'Frost-resistant to −5°C. Clean with damp cloth.',
    color: 'Cream',
  },
  {
    slug: 'solar-lantern-set-of-2',
    name: 'Solar Lantern (Set of 2)',
    subtitle: 'Matte black · warm white LED',
    description:
      'Sunset in, glow out. These powder-coated steel lanterns charge by day and light paths, tables and beds for up to 8 hours. No wiring, no fuss — just evening atmosphere.',
    price: '29.90',
    categorySlug: 'lighting',
    spaceSlugs: 'garden,balcony',
    styleSlugs: 'modern,natural,warm-minimal',
    collectionSlugs: 'garden-glow,mood-lighting',
    image: '/images/product-solar-lantern.jpg',
    badge: 'Solar',
    rating: 4.5,
    reviewCount: 1146,
    isBestSeller: true,
    featured: true,
    materials: 'Powder-coated steel, IP44, integrated solar panel',
    dimensions: 'Ø 14 × 22 cm each',
    care: 'Wipe solar panel regularly for best charging performance.',
    color: 'Black',
    electrical: true,
  },
  {
    slug: 'outdoor-sofa-set',
    name: 'Outdoor Sofa Set',
    subtitle: 'Acacia wood · beige cushions',
    description:
      'Our most-loved outdoor set. Solid acacia frame with deep, weather-resistant cushions in warm beige. Built for long evenings, fresh air and doing absolutely nothing.',
    price: '299.00',
    comparePrice: '349.00',
    categorySlug: 'outdoor',
    spaceSlugs: 'garden,balcony',
    styleSlugs: 'natural,organic,mediterranean',
    collectionSlugs: 'balcony-escape',
    image: '/images/product-outdoor-sofa.jpg',
    rating: 4.7,
    reviewCount: 341,
    isBestSeller: true,
    featured: true,
    materials: 'FSC-certified acacia wood, olefin cushions',
    dimensions: 'Sofa 190 × 85 × 78 cm · table 90 × 60 cm',
    care: 'Cover or store cushions in wet weather. Oil wood yearly.',
    color: 'Beige',
  },
  {
    slug: 'rattan-accent-chair',
    name: 'Rattan Accent Chair',
    subtitle: 'Sculptural curve · natural',
    description:
      'A single piece that finishes a room. Hand-woven rattan over a solid frame, shaped into a soft sculptural curve that reads beautiful from every angle.',
    price: '129.00',
    categorySlug: 'interior',
    spaceSlugs: 'living-room,bedroom,balcony',
    styleSlugs: 'natural,organic,mediterranean,japandi',
    image: '/images/product-rattan-chair.jpg',
    badge: 'New',
    rating: 4.6,
    reviewCount: 214,
    isNew: true,
    featured: true,
    materials: 'Natural rattan, solid rubberwood frame',
    dimensions: '68 × 74 × 82 cm · seat height 42 cm',
    care: 'Dust regularly; keep away from prolonged moisture.',
    color: 'Natural',
  },
  {
    slug: 'linen-cushion-set-of-3',
    name: 'Linen Cushion Covers (Set of 3)',
    subtitle: 'Olive · caramel · cream',
    description:
      'The fastest room refresh we know. Three stonewashed linen covers in our warmest palette, with hidden zips and generous overlap for a plump, tailored look.',
    price: '44.90',
    categorySlug: 'interior',
    spaceSlugs: 'living-room,bedroom',
    styleSlugs: 'warm-minimal,natural,organic',
    image: '/images/product-linen-cushions.jpg',
    badge: 'Set of 3',
    rating: 4.7,
    reviewCount: 528,
    featured: true,
    materials: '100% stonewashed linen, 240 g/m²',
    dimensions: '45 × 45 cm (fits 50 × 50 inserts)',
    care: 'Machine wash 30°C, line dry, warm iron.',
    color: 'Olive',
  },
  {
    slug: 'oak-wall-shelf',
    name: 'Oak Wall Shelf',
    subtitle: 'Solid oak · 80 cm',
    description:
      'One clean line of solid oak that makes books, ceramics and trailing plants feel intentional. Invisible mounting brackets included.',
    price: '39.90',
    categorySlug: 'decoration',
    spaceSlugs: 'living-room,home-office,bedroom',
    styleSlugs: 'warm-minimal,japandi,modern',
    image: '/images/product-oak-wall-shelf.jpg',
    rating: 4.5,
    reviewCount: 317,
    materials: 'Solid oiled oak, steel hidden brackets',
    dimensions: '80 × 14 × 3.8 cm',
    care: 'Wipe dry; re-oil once a year if desired.',
    color: 'Oak',
  },
  {
    slug: 'woven-pendant-lamp',
    name: 'Woven Pendant Lamp',
    subtitle: 'Rattan · Ø 40 cm',
    description:
      'Hand-woven rattan throws a thousand little shadows at dusk. Hangs over dining tables, kitchen islands or reading corners. Cord adjustable up to 150 cm.',
    price: '59.90',
    categorySlug: 'lighting',
    spaceSlugs: 'living-room,kitchen,bedroom',
    styleSlugs: 'natural,japandi,organic',
    collectionSlugs: 'mood-lighting',
    image: '/images/product-pendant-lamp.jpg',
    badge: 'New',
    rating: 4.6,
    reviewCount: 189,
    isNew: true,
    materials: 'Natural rattan, E27 fitting',
    dimensions: 'Ø 40 × 30 cm · cord 150 cm max',
    care: 'Dust with brush attachment.',
    color: 'Natural',
    electrical: true,
  },
  {
    slug: 'garden-flame-torch',
    name: 'Garden Flame Torch',
    subtitle: 'Steel & oak · 120 cm',
    description:
      'Real flame, modern form. A weighted steel head on a solid oak pole anchors borders and pathways with the oldest mood lighting there is.',
    price: '34.90',
    categorySlug: 'garden',
    spaceSlugs: 'garden,balcony',
    styleSlugs: 'modern,natural',
    collectionSlugs: 'garden-glow',
    image: '/images/product-garden-torch.jpg',
    rating: 4.4,
    reviewCount: 267,
    materials: 'Powder-coated steel, solid oak pole',
    dimensions: 'Ø 15 × 120 cm · 1.8 kg',
    care: 'Store indoors outside season. Keep flame away from foliage.',
    color: 'Black',
  },
  {
    slug: 'seagrass-basket-set-of-2',
    name: 'Seagrass Baskets (Set of 2)',
    subtitle: 'Natural weave · with handles',
    description:
      'Hides blankets, toys, firewood and everything else that needs a home. Hand-woven seagrass with sturdy handles — soft storage that looks good empty.',
    price: '27.90',
    categorySlug: 'organisation',
    spaceSlugs: 'living-room,bedroom,bathroom',
    styleSlugs: 'natural,organic,japandi,warm-minimal',
    image: '/images/product-seagrass-basket.jpg',
    badge: 'Set of 2',
    rating: 4.6,
    reviewCount: 443,
    materials: 'Hand-woven seagrass',
    dimensions: 'Ø 32 × 30 cm & Ø 38 × 36 cm',
    care: 'Spot clean; keep dry.',
    color: 'Natural',
  },
  {
    slug: 'teak-entryway-bench',
    name: 'Teak Entryway Bench',
    subtitle: 'Slatted solid teak · 110 cm',
    description:
      'The bench that makes an entrance. Solid slatted teak with a lower shelf for shoes and baskets — equally at home in hallways, bedrooms and covered terraces.',
    price: '149.00',
    categorySlug: 'outdoor',
    spaceSlugs: 'living-room,balcony,garden',
    styleSlugs: 'natural,japandi,modern',
    image: '/images/product-teak-bench.jpg',
    rating: 4.8,
    reviewCount: 156,
    isNew: true,
    materials: 'Solid teak, stainless steel hardware',
    dimensions: '110 × 38 × 45 cm',
    care: 'Teak weathers gracefully; treat with teak oil to retain colour.',
    color: 'Teak',
  },
  {
    slug: 'ceramic-vase-set-of-3',
    name: 'Ceramic Vases (Set of 3)',
    subtitle: 'Terracotta · sand · off-white',
    description:
      'Three matte glazes, one warm family. Style together on a shelf or spread through the house — they make even supermarket flowers look curated.',
    price: '42.90',
    categorySlug: 'decoration',
    spaceSlugs: 'living-room,bedroom,kitchen',
    styleSlugs: 'warm-minimal,organic,mediterranean,natural',
    image: '/images/product-ceramic-vase-set.jpg',
    badge: 'Set of 3',
    rating: 4.7,
    reviewCount: 391,
    materials: 'Matte glazed ceramic',
    dimensions: 'H 14 / 20 / 26 cm',
    care: 'Hand wash recommended.',
    color: 'Terracotta',
  },
  {
    slug: 'tall-fiberstone-planter',
    name: 'Tall Fiberstone Planter',
    subtitle: 'Warm grey · Ø 38 × 70 cm',
    description:
      'Architectural height for indoor jungles. Lightweight fiberstone looks like cast concrete but moves easily and resists frost on balconies all year round.',
    price: '69.90',
    categorySlug: 'garden',
    spaceSlugs: 'living-room,balcony,garden,home-office',
    styleSlugs: 'modern,warm-minimal,organic',
    image: '/images/product-palm-planter.jpg',
    rating: 4.5,
    reviewCount: 228,
    materials: 'Fiberstone (fibreglass-reinforced stone composite)',
    dimensions: 'Ø 38 × 70 cm · 6.5 kg',
    care: 'Frost-resistant. Drainage hole with plug included.',
    color: 'Grey',
  },
  {
    slug: 'solar-string-lights',
    name: 'Solar String Lights',
    subtitle: '12 warm bulbs · 6.8 m',
    description:
      'Instant balcony magic. Twelve warm-white bulbs on a solar string — no plugs, no cables across the floor. Dusk-sensor switches on automatically.',
    price: '24.90',
    categorySlug: 'lighting',
    spaceSlugs: 'balcony,garden',
    styleSlugs: 'natural,warm-minimal,mediterranean',
    collectionSlugs: 'balcony-escape,garden-glow,mood-lighting',
    image: '/images/product-string-lights.jpg',
    badge: 'Solar',
    rating: 4.4,
    reviewCount: 834,
    materials: 'IP44 solar panel, warm-white LED bulbs',
    dimensions: '6.8 m string · 12 bulbs',
    care: 'Keep panel facing south for best charge.',
    color: 'Black',
    electrical: true,
  },
  {
    slug: 'oak-wall-clock',
    name: 'Oak Wall Clock',
    subtitle: 'Silent movement · Ø 40 cm',
    description:
      'A clock you stop noticing — in the best way. Solid oak face, no ticking, warm minimal numerals. The quiet anchor for kitchens and home offices.',
    price: '49.90',
    categorySlug: 'decoration',
    spaceSlugs: 'kitchen,home-office,living-room',
    styleSlugs: 'warm-minimal,japandi,modern',
    image: '/images/product-wall-clock.jpg',
    rating: 4.6,
    reviewCount: 174,
    materials: 'Solid oak, silent quartz movement',
    dimensions: 'Ø 40 × 4 cm · 1 AA battery',
    care: 'Wipe with dry cloth.',
    color: 'Oak',
    electrical: true,
  },
  {
    slug: 'round-fire-pit-table',
    name: 'Round Fire Pit Table',
    subtitle: 'Fiberstone · Ø 80 cm',
    description:
      'The new centre of the terrace. Clean-round fiberstone bowl, hidden 5 kg gas bottle space and a flame that keeps guests outside an hour longer.',
    price: '249.00',
    categorySlug: 'outdoor',
    spaceSlugs: 'garden,balcony',
    styleSlugs: 'modern,organic',
    collectionSlugs: 'garden-glow',
    image: '/images/product-fire-pit.jpg',
    badge: 'New',
    rating: 4.7,
    reviewCount: 98,
    isNew: true,
    materials: 'Fiberstone bowl, stainless steel burner',
    dimensions: 'Ø 80 × 45 cm · fits 5 kg gas bottle',
    care: 'Cover when not in use. Never operate under cover.',
    color: 'Grey',
  },
];

async function main() {
  console.log('Seeding categories…');
  await db.category.deleteMany();
  for (const c of categories) {
    await db.category.create({ data: c });
  }

  console.log('Seeding products…');
  await db.product.deleteMany();
  for (const p of products) {
    const imgShort = p.image.replace('/images/product-', '').replace('.jpg', '');
    const gallery = `/images/gallery-${imgShort}-lifestyle.jpg,/images/gallery-${imgShort}-detail.jpg`;
    await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice ?? null,
        categorySlug: p.categorySlug,
        spaceSlugs: p.spaceSlugs,
        styleSlugs: p.styleSlugs,
        collectionSlugs: p.collectionSlugs ?? '',
        image: p.image,
        hoverImage: `/images/gallery-${imgShort}-lifestyle.jpg`,
        gallery,
        badge: p.badge ?? null,
        rating: p.rating,
        reviewCount: p.reviewCount,
        isBestSeller: p.isBestSeller ?? false,
        isNew: p.isNew ?? false,
        featured: p.featured ?? false,
        materials: p.materials,
        dimensions: p.dimensions,
        care: p.care,
        color: p.color,
        electrical: p.electrical ?? false,
        complianceStatus: 'APPROVED',
        safetyJson: JSON.stringify({
          productIdentifier: p.slug.toUpperCase(),
          manufacturerName: '[TO BE COMPLETED]',
          manufacturerAddress: '[TO BE COMPLETED]',
          manufacturerEmail: 'compliance@e-com.casa',
          euResponsiblePerson: '[TO BE COMPLETED]',
          warnings: p.electrical
            ? 'Electrical product. Read the supplied instructions before first use. Keep away from water unless stated IP rating allows.'
            : 'Check packaging for small parts before use around children.',
          safetyInstructions: 'See product manual enclosed with delivery.',
          ceMarking: p.electrical ? 'PENDING_VERIFICATION' : 'NOT_APPLICABLE',
          countryOfOrigin: '[TO BE COMPLETED]',
        }),
      },
    });
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
