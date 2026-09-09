// ============================================================
// E-com.casa — catalogue re-classifier (post-import QA fix)
// ------------------------------------------------------------
// Re-runs category/space assignment for imported products using
// ALL persisted research evidence (breadcrumbs, source category,
// title, description) with weighted scoring instead of
// first-match. Only merchandising metadata changes — factual
// research fields are never touched (§20).
// Run: bun scripts/catalog-research-v2/reclassify.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const CATEGORY_SIGNALS: Array<{ category: string; subs: string[]; re: RegExp; weight: number }> = [
  { category: 'wall-panels', subs: ['wood-slat-panels'], re: /\bslat|\bslatted|lamell|wall panel|acoustic panel|cladding|wall cladding/i, weight: 3 },
  { category: 'wall-panels', subs: ['decorative-panels'], re: /3d panel|decorative panel|fluted panel|wall panels?\b/i, weight: 2 },
  { category: 'lighting', subs: ['outdoor-lighting'], re: /outdoor (light|lamp|wall light|bollard|spot|lantern)|solar (light|lamp|lantern|torch)|garden light|garden lantern|buitenlamp|lawn lamp/i, weight: 3 },
  { category: 'lighting', subs: ['portable-lighting'], re: /portable (lamp|light)|table lamp|desk lamp|cordless lamp|rechargeable|floor lamp|clip (lamp|light)|pinboard light|shelf light/i, weight: 2.5 },
  { category: 'lighting', subs: ['led-lighting'], re: /\bled\b|pendant|chandelier|ceiling light|ceiling lamp|wall sconce|wall light|semi-flush|\blamp\b|\blampe\b|\bleuchte\b|lighting/i, weight: 2 },
  { category: 'planters', subs: ['pots'], re: /planter|plant pot|flower ?pot|flowerpot|jardiniere|jardineira|maceta|macetero|bloempot|raised bed|plant trellis|\bpot(s)?\b(?! ?stake)/i, weight: 2.5 },
  { category: 'garden', subs: ['lanterns'], re: /lantern|laterne|farol|wind light|photophore|temple lantern/i, weight: 2.5 },
  { category: 'garden', subs: ['garden-decoration'], re: /garden (decor|ornament|stake|edging|globe|torch)|bird ?house|bird ?feeder|bird ?bath|fire ?pit|fire bowl|chiminea|wind chime|garden sculpture|garden statue|lawn/i, weight: 2.5 },
  { category: 'outdoor', subs: ['outdoor-furniture'], re: /outdoor (sofa|chair|table|bench|lounge|dining|cushion)|garden (stool|furniture|bench|seat)|bistro|sun lounger|parasol|hammock|daybed|lounge cushion|patio (set|furniture)/i, weight: 2.5 },
  { category: 'outdoor-privacy', subs: ['privacy-screens'], re: /privacy (screen|panel|fence)|balcony screen|garden screen|trellis screen|artificial hedge|fence panel|sichtschutz/i, weight: 3 },
  { category: 'decoration', subs: ['mirrors'], re: /\bmirror\b|espejo|spiegel|miroir|espelho/i, weight: 2.5 },
  { category: 'organisation', subs: [], re: /basket|storage|organiser|organizer|shoe (rack|storage)|shelf unit|hooks?|rack\b|storage box|storage bench|tidy|greenhouse flower rack/i, weight: 2 },
  { category: 'kitchen-dining', subs: [], re: /teapot|serving board|dining bowl|tableware|cutting board|storage jar|carafe|mug|bar stool|bread bin/i, weight: 2 },
  { category: 'gadgets-smart-home', subs: [], re: /smart (plug|home|speaker|sensor)|air (purifier|humidifier)|diffuser|robot vacuum|water oxygen|circulation device|projector/i, weight: 2.5 },
  { category: 'accessories', subs: [], re: /cushion|throw\b|doormat|pillow|candle(?!holder)|photo frame|bookend|incense|cashmere/i, weight: 2 },
  { category: 'decoration', subs: [], re: /wall (art|decor|decoration)|sculpture|statue|vase\b|ornament|relief|etagere|decorative accent/i, weight: 1.5 },
  { category: 'outdoor', subs: [], re: /garden|outdoor|patio|terrace|balcony/i, weight: 1 },
  { category: 'decoration', subs: [], re: /decor|accent|home accessory/i, weight: 1 },
];

const SPACE_HINTS: Array<{ space: string; re: RegExp }> = [
  { space: 'garden', re: /garden|patio|lawn|bird ?house|lantern|edging/i },
  { space: 'terrace', re: /terrace|terrazzo|outdoor lounge/i },
  { space: 'balcony', re: /balcony/i },
  { space: 'outdoor-lounge', re: /outdoor sofa|lounge set|lounge cushion/i },
  { space: 'living-room', re: /living room|sofa|lounge\b|wall panel|sconce|pendant/i },
  { space: 'bedroom', re: /bedroom|bedside|nightstand/i },
  { space: 'kitchen', re: /kitchen|teapot|tableware/i },
  { space: 'dining', re: /dining/i },
  { space: 'home-office', re: /home office|desk|office/i },
  { space: 'bathroom', re: /bathroom/i },
  { space: 'entrance', re: /entrance|hallway|doormat|shoe/i },
];

function classify(breadcrumbs: string, sourceCategory: string, title: string, description: string, fallbackCategory: string): { category: string; subs: string[]; confidence: number } {
  const corpora: Array<{ text: string; weight: number }> = [
    { text: breadcrumbs, weight: 3 },
    { text: sourceCategory, weight: 3 },
    { text: title, weight: 2 },
    { text: description.slice(0, 400), weight: 1 },
  ];
  const scores = new Map<string, { score: number; subs: string[] }>();
  for (const sig of CATEGORY_SIGNALS) {
    for (const { text, weight } of corpora) {
      if (!text) continue;
      if (sig.re.test(text)) {
        const cur = scores.get(sig.category) ?? { score: 0, subs: sig.subs };
        cur.score += sig.weight * weight;
        scores.set(sig.category, cur);
      }
    }
  }
  if (scores.size === 0) return { category: fallbackCategory, subs: [], confidence: 0.3 };
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const [best, bestEntry] = ranked[0];
  const bestScore = bestEntry.score;
  const fallbackScore = scores.get(fallbackCategory)?.score ?? 0;
  // prefer the fallback when it is essentially tied (stability)
  if (fallbackScore > 0 && bestScore - fallbackScore < 2) {
    return { category: fallbackCategory, subs: scores.get(fallbackCategory)?.subs ?? [], confidence: 0.6 };
  }
  return { category: best, subs: bestScore >= 6 ? bestEntry.subs : [], confidence: Math.min(1, bestScore / 9) };
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  let changed = 0;
  try {
    const products = await db.product.findMany({ select: { id: true, sku: true, name: true, categorySlug: true, subcategorySlugs: true, sourceResearchId: true } });
    for (const p of products) {
      if (!p.sourceResearchId) continue;
      const r = await db.researchProduct.findUnique({ where: { id: p.sourceResearchId }, select: { sourceCategory: true, sourceDataJson: true, sourceProductName: true, sourceDescription: true } });
      if (!r) continue;
      let breadcrumbs = '';
      try {
        breadcrumbs = (JSON.parse(r.sourceDataJson ?? '{}').breadcrumbs as string[] | undefined)?.join(' > ') ?? '';
      } catch {
        /* none */
      }
      const { category, subs, confidence } = classify(breadcrumbs, r.sourceCategory ?? '', r.sourceProductName ?? '', r.sourceDescription ?? '', p.categorySlug);
      if (category !== p.categorySlug) {
        const spaces = SPACE_HINTS.filter((s) => s.re.test(`${breadcrumbs} ${r.sourceCategory ?? ''} ${r.sourceProductName ?? ''}`)).map((s) => s.space);
        const finalSpaces = spaces.length > 0 ? spaces.slice(0, 3).join(',') : p.categorySlug === 'garden' || category === 'garden' ? 'garden' : 'living-room';
        await db.product.update({
          where: { id: p.id },
          data: { categorySlug: category, subcategorySlugs: subs.join(','), spaceSlugs: finalSpaces },
        });
        changed++;
        console.log(`reclassified ${p.sku} "${p.name.slice(0, 44)}" : ${p.categorySlug} → ${category} (conf ${confidence.toFixed(2)}, bc: ${breadcrumbs.slice(0, 40) || '—'})`);
      }
    }
    console.log(`\nreclassify: ${changed}/${products.length} products updated`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('[reclassify] FATAL:', e);
  process.exit(1);
});
