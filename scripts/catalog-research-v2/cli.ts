// ============================================================
// E-com.casa — CATALOG SCRAPER V2 · CLI orchestrator
// ------------------------------------------------------------
// One-shot deep product ingestion:
//   SOURCE → REAL PRODUCT PAGE → FULL EXTRACTION → STRUCTURED
//   RAW RECORD → NORMALIZATION → VALIDATION → DEDUPLICATION →
//   COMPLETENESS SCORE → RESEARCH DATABASE → E-COM.CASA DEMO
//   PRODUCT → POSTGRESQL/NEON → STOREFRONT
//
// Usage:
//   npm run catalog:scrape-v2
//   npm run catalog:scrape-v2 -- --dry-run
//   npm run catalog:scrape-v2 -- --source=kave-home
//   npm run catalog:scrape-v2 -- --limit=100
//   npm run catalog:scrape-v2 -- --category=lighting
//   npm run catalog:scrape-v2 -- --resume=<runId>
//
// NEVER exposed as a public route, cron job or scheduled job.
// ============================================================

import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { V2_CONFIG, CATEGORY_PREFIX } from './config';
import { SOURCES_V2, getSourceV2, type SourceConfigV2 } from './sources';
import { getRobots, isAllowed, discoverViaSitemaps } from './robots-sitemap';
import { classifyUrl, normalizeProductUrl } from './urls';
import { politeFetch, requestErrors } from './http';
import { extractProductPage, type ExtractedPage } from './extract';
import { normalizePrice, normalizeDimensions, normalizeWeight, normalizeMaterial, normalizeColour, normalizeSpecs, detectElectrical, detectOutdoorUse, mapCatalogFields } from './normalize';
import { scoreProduct } from './score';
import { dedupeProducts, selectCanonical, type DedupeInput, type DedupeResult } from './dedupe';
import { selectDiverse, pickTopLaunch, pickHeroes } from './select';
import { generateCopy, flushCopyCache } from './copy';
import { validateGallery, downloadResearchImages, assignPublicImages, inferShippingClass } from './images';
import { importSelected, type DemoProductForImport } from './import';
import { writeReports, type SourceReportRow, type ProductReportRow, type ImageReportRow, type MissingDataRow } from './reports';

// ---------------- CLI args ----------------

interface Args {
  dryRun: boolean;
  source?: string;
  limit?: number;
  category?: string;
  resume?: string;
  phase?: 'full' | 'crawl' | 'build';
}

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--source=')) args.source = a.split('=')[1];
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--category=')) args.category = a.split('=')[1];
    else if (a.startsWith('--resume=')) args.resume = a.split('=')[1];
    else if (a.startsWith('--phase=')) args.phase = a.split('=')[1] as Args['phase'];
  }
  return args;
}

// ---------------- State ----------------

interface ParsedProduct {
  id: string;
  sourceKey: string;
  url: string;
  page: ExtractedPage;
  prices: ReturnType<typeof normalizePrice>;
  dims: ReturnType<typeof normalizeDimensions>;
  weight: string | null;
  material: string | null;
  colour: string | null;
  specs: ReturnType<typeof normalizeSpecs>;
  elec: ReturnType<typeof detectElectrical>;
  outdoor: boolean;
  assignment: ReturnType<typeof mapCatalogFields>;
  scores: ReturnType<typeof scoreProduct>;
}

interface SourceStat {
  key: string;
  robotsStatus: string;
  seedUrls: number;
  sitemapsProcessed: number;
  listingPages: number;
  productPages: number;
  successfulPages: number;
  blockedPages: number;
  failedPages: number;
  productsDiscovered: number;
  productsParsed: number;
  productsAccepted: number;
  productsRejected: number;
  imagesFound: number;
  status: 'pending' | 'running' | 'success' | 'partial' | 'blocked' | 'failed';
}

const log = (...a: unknown[]): void => console.log('[scrape-v2]', ...a);

// ---------------- z-ai search discovery aid ----------------

interface SearchHit {
  url: string;
  name: string;
  snippet?: string;
  host_name?: string;
}

function parseCliJson(out: string): SearchHit[] | null {
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(out.slice(start, end + 1)) as SearchHit[];
    } catch {
      /* fallthrough */
    }
  }
  return null;
}

function searchIndex(query: string, num = 10): SearchHit[] {
  try {
    const out = execFileSync('z-ai', ['function', '-n', 'web_search', '-a', JSON.stringify({ query, num })], {
      encoding: 'utf-8',
      timeout: 45_000,
    });
    return parseCliJson(out) ?? [];
  } catch {
    return [];
  }
}

// ---------------- Main ----------------

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = new Date();
  log('E-COM.CASA CATALOG SCRAPER V2 — one-shot deep product extraction');
  log(`mode=${args.dryRun ? 'DRY-RUN' : 'import'} source=${args.source ?? 'all'} limit=${args.limit ?? 'default'} category=${args.category ?? 'all'}`);

  const db = new PrismaClient();

  // Run record (resume support, §93) — --resume accepts comma-separated run ids
  let runId: string;
  const resumeIds = args.resume ? args.resume.split(',').map((x) => x.trim()).filter(Boolean) : [];
  if (resumeIds.length > 0) {
    for (const rid of resumeIds) {
      const existing = await db.researchRun.findUnique({ where: { id: rid } });
      if (!existing) throw new Error(`Run ${rid} not found`);
    }
    runId = resumeIds[resumeIds.length - 1]; // stats land on the latest run
    await db.researchRun.update({ where: { id: runId }, data: { notes: `resumed ${new Date().toISOString()}` } });
    log(`resuming run(s) ${resumeIds.join(', ')}`);
  } else {
    const run = await db.researchRun.create({
      data: {
        mode: args.dryRun ? 'dry-run' : 'import',
        engine: 'v2',
        status: 'RUNNING',
        sourceCount: args.source ? 1 : SOURCES_V2.filter((s) => s.enabled).length,
        configJson: JSON.stringify({ ...V2_CONFIG.limits, providers: V2_CONFIG.providers, images: { validate: V2_CONFIG.images.validatePerProduct, download: V2_CONFIG.images.downloadPerProduct } }),
      },
    });
    runId = run.id;
    log(`run ${runId} created`);
  }

  // Global visited history across ALL runs — a new crawl pass pulls the NEXT batch
  // of candidates instead of re-fetching the same product pages (§92/§93)
  const visitedUrls = new Set(
    (await db.researchPage.findMany({ where: { httpStatus: 200, pageType: 'PRODUCT' }, select: { url: true } })).map((r) => r.url),
  );

  const sources = args.source ? [getSourceV2(args.source)].filter((s): s is SourceConfigV2 => Boolean(s)) : SOURCES_V2.filter((s) => s.enabled);
  const sourceStats: SourceStat[] = [];
  const parsed: ParsedProduct[] = [];
  const allImageRows: ImageReportRow[] = [];
  let productPagesFetched = 0;
  let productsDiscoveredTotal = 0;

  try {
    // ================= RESUME: hydrate parsed products from research DB (§93) =================
    if (resumeIds.length > 0) {
      const hydrated = await hydrateFromRun(db, resumeIds);
      parsed.push(...hydrated.products);
      productPagesFetched = hydrated.productPages;
      productsDiscoveredTotal = hydrated.discovered;
      for (const s of hydrated.sourceStats) sourceStats.push(s);
      log(`hydrated ${parsed.length} parsed products from run(s) ${resumeIds.join(', ')} (skipping discovery — §93 resume)`);
    } else {
    // ================= DISCOVERY + EXTRACTION =================
    for (const source of sources) {
      const stat: SourceStat = { key: source.key, robotsStatus: 'unknown', seedUrls: source.categorySeedUrls.length, sitemapsProcessed: 0, listingPages: 0, productPages: 0, successfulPages: 0, blockedPages: 0, failedPages: 0, productsDiscovered: 0, productsParsed: 0, productsAccepted: 0, productsRejected: 0, imagesFound: 0, status: 'running' };
      sourceStats.push(stat);
      log(`── source ${source.key} (${source.name})`);

      // upsert ResearchSource
      await db.researchSource.upsert({
        where: { key: source.key },
        create: { key: source.key, name: source.name, domain: source.domain, homepage: source.homepage, tier: source.tier, enabled: source.enabled, priority: source.priority, lastRunAt: new Date() },
        update: { lastRunAt: new Date() },
      });

      if (!V2_CONFIG.providers.http) {
        stat.status = 'failed';
        stat.robotsStatus = 'http-disabled';
        continue;
      }

      // ---- robots.txt (§52) ----
      let origin = source.homepage;
      try {
        origin = new URL(source.homepage).origin;
      } catch {
        /* keep */
      }
      const robots = await getRobots(origin);
      stat.robotsStatus = robots.status === 'OK' ? (robots.disallowAll ? 'DISALLOW-ALL' : 'OK') : robots.status;

      const candidateUrls = new Map<string, { via: string; rank: number }>();
      const addCandidate = (rawUrl: string, via: string, rank: number): void => {
        const url = normalizeProductUrl(rawUrl);
        if (!url || !url.includes(source.domain)) return;
        const type = classifyUrl(url, source);
        if (type !== 'PRODUCT') return;
        if (!isAllowed(robots, url)) return;
        if (candidateUrls.has(url)) return;
        candidateUrls.set(url, { via, rank });
      };

      // ---- 1) sitemap discovery (§5 priority 1) ----
      if (robots.status !== 'BLOCKED') {
        const sm = await discoverViaSitemaps(source, robots);
        stat.sitemapsProcessed = sm.sitemapsProcessed.length;
        for (const [i, u] of sm.urls.entries()) addCandidate(u, 'sitemap', i);
        log(`  sitemaps: ${sm.sitemapsProcessed.length} processed, ${sm.urls.length} urls, product candidates so far: ${candidateUrls.size}`);
        if (sm.sitemapsFailed.length > 0) log(`  sitemap failures (recorded): ${sm.sitemapsFailed.length}`);
      } else {
        log('  robots blocked — recording honestly (§3/§90)');
      }

      // ---- 2) category seed crawl when sitemaps insufficient ----
      if (candidateUrls.size < V2_CONFIG.limits.maxProductCandidatesPerSource && robots.status === 'OK') {
        for (const catUrl of source.categorySeedUrls.slice(0, 4)) {
          if (!isAllowed(robots, catUrl)) continue;
          if (candidateUrls.size >= V2_CONFIG.limits.maxProductCandidatesPerSource) break;
          const res = await politeFetch(catUrl);
          stat.listingPages++;
          if (!res.ok || !res.body) {
            if (res.error?.errorType === 'blocked') stat.blockedPages++;
            else stat.failedPages++;
            continue;
          }
          stat.successfulPages++;
          await recordPage(db, runId, source.key, catUrl, res, 'CATEGORY');
          // extract product links from the listing page
          const $ = (await import('cheerio')).load(res.body);
          const seen = new Set<string>();
          $('a[href]').each((_i, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            try {
              const abs = new URL(href, catUrl).toString();
              if (seen.has(abs)) return;
              seen.add(abs);
              addCandidate(abs, 'category', candidateUrls.size);
            } catch {
              /* invalid href */
            }
          });
          log(`  listing ${catUrl} → candidates: ${candidateUrls.size}`);
        }
      }

      // ---- 3) public search-index discovery aid (never the extraction source) ----
      if (V2_CONFIG.providers.websearch && candidateUrls.size < V2_CONFIG.limits.maxProductCandidatesPerSource) {
        for (const q of source.searchQueries) {
          if (candidateUrls.size >= V2_CONFIG.limits.maxProductCandidatesPerSource) break;
          const hits = searchIndex(q, 10);
          for (const h of hits) addCandidate(h.url, 'search', candidateUrls.size);
        }
        log(`  search aid → candidates: ${candidateUrls.size}`);
      }

      // ---- bounded product-page extraction ----
      // Relevance-first ranking: prefer URLs whose slugs carry category keywords
      // so bounded budgets are not wasted on irrelevant categories (§44/§45)
      const RELEVANCE_RE = /(lamp|light|lantern|leuchte|lampe|planter|pot\b|vase|mirror|spiegel|panel|slat|lamell|garden|garten|outdoor|candle|solar|led|cushion|basket|korb|tray|bowl|pendant|hanging|chandelier|torch|fire|hedge|screen|privacy|sichtschutz|jardiniere|macetero|windlight|photophore|string|garland|fairy)/i;
      const ranked = [...candidateUrls.entries()]
        .map(([url, meta]) => ({ url, meta, rel: RELEVANCE_RE.test(url) ? 0 : 1 }))
        .sort((a, b) => a.rel - b.rel || a.meta.rank - b.meta.rank);

      for (const { url } of ranked) {
        if (productPagesFetched >= V2_CONFIG.limits.candidateTarget) break;
        if (stat.productPages >= V2_CONFIG.limits.maxProductCandidatesPerSource) break;
        if (visitedUrls.has(url)) {
          continue; // free skip — does not consume the per-source page budget
        }
        const res = await politeFetch(url);
        stat.productPages++;
        productPagesFetched++;
        if (!res.ok || !res.body) {
          if (res.error?.errorType === 'blocked') {
            stat.blockedPages++;
            // §3: blocked → stop crawling this source
            log('  BLOCKED — stopping requests to this source (not circumventing)');
            break;
          }
          stat.failedPages++;
          await recordError(db, runId, source.key, url, 'fetch', res.error?.errorType ?? 'network', res.error?.message ?? 'fetch failed');
          continue;
        }
        stat.successfulPages++;
        const page = await recordPage(db, runId, source.key, url, res, 'PRODUCT');

        const extracted = extractProductPage(res.body, url);
        stat.productsDiscovered++;
        productsDiscoveredTotal++;

        if (!extracted.isProduct || !extracted.title) {
          stat.productsRejected++;
          await recordError(db, runId, source.key, url, 'validate', 'not-a-product', `signals: ${extracted.productSignals.join(', ') || 'none'}`);
          continue;
        }
        stat.productsParsed++;

        const prices = normalizePrice(extracted, source.defaultCurrency);
        if (prices.amount === null) {
          // price-less pages are weak research records — rejected (§55 preferred fields)
          stat.productsRejected++;
          await recordError(db, runId, source.key, url, 'validate', 'no-price', 'no extractable price');
          continue;
        }
        const specs = normalizeSpecs(extracted.specs);
        const elec = detectElectrical(extracted);
        const p: ParsedProduct = {
          id: page.id,
          sourceKey: source.key,
          url,
          page: extracted,
          prices,
          dims: normalizeDimensions(extracted),
          weight: normalizeWeight(extracted),
          material: normalizeMaterial(extracted),
          colour: normalizeColour(extracted),
          specs,
          elec,
          outdoor: detectOutdoorUse(extracted),
          assignment: mapCatalogFields(extracted, { defaultCategory: args.category }),
          scores: scoreProduct(extracted, args.category ?? 'decoration', elec),
        };
        parsed.push(p);
        stat.productsAccepted++;
        stat.imagesFound += extracted.gallery.length;

        // persist research layer (product + variants + images + attributes + evidence)
        await persistResearchProduct(db, runId, source.key, page.id, p);
        log(`  ✓ parsed [${stat.productsParsed}/${ranked.length}] ${extracted.title.slice(0, 60)} · ${prices.amount} ${prices.currency} · imgs=${extracted.gallery.length} · Q=${p.scores.qualityScore}`);
      }

      stat.status =
        stat.blockedPages > 0 && stat.productsAccepted === 0
          ? 'blocked'
          : stat.productsAccepted > 0
            ? stat.failedPages + stat.blockedPages > 0
              ? 'partial'
              : 'success'
            : stat.blockedPages > 0
              ? 'blocked'
              : 'failed';
      log(`  → ${stat.status}: accepted=${stat.productsAccepted} rejected=${stat.productsRejected} blocked=${stat.blockedPages}`);

      if (productPagesFetched >= V2_CONFIG.limits.candidateTarget) {
        log(`global candidate target reached (${productPagesFetched}) — stopping discovery (§45)`);
        break;
      }
    }
    } // end discovery-else (resume path skips discovery)

    // ================= DEDUPLICATION (§28/§29) =================
    const dedupeInputs: DedupeInput[] = parsed.map((p) => ({
      id: p.id,
      sourceKey: p.sourceKey,
      sourceUrl: p.url,
      canonicalUrl: p.page.canonicalUrl ? normalizeProductUrl(p.page.canonicalUrl) : undefined,
      gtin: p.page.gtin,
      ean: p.page.ean,
      mpn: p.page.mpn,
      sku: p.page.sku,
      name: p.page.title ?? '',
      brand: p.page.brand,
      material: p.material,
      dimsText: p.dims.text,
    }));
    const sourcePriority = new Map(SOURCES_V2.map((s) => [s.key, s.priority]));
    const qualityScores = new Map(parsed.map((p) => [p.id, p.scores.qualityScore]));
    const dedupeResults: Map<string, DedupeResult> = dedupeProducts(dedupeInputs);
    const canonicalIds = new Set(selectCanonical(dedupeInputs, dedupeResults, qualityScores, sourcePriority));
    const canonical = parsed.filter((p) => canonicalIds.has(p.id));
    const duplicateCount = parsed.length - canonical.length;
    log(`dedupe: ${parsed.length} parsed → ${canonical.length} canonical (${duplicateCount} duplicates)`);

    // persist dedupe verdicts
    for (const p of parsed) {
      const r = dedupeResults.get(p.id);
      if (!r) continue;
      await db.researchProduct.update({
        where: { id: p.id },
        data: {
          duplicateKind: r.kind,
          duplicateGroupId: r.duplicateGroupId,
          duplicateConfidence: r.duplicateConfidence,
          status: canonicalIds.has(p.id) ? 'NORMALIZED' : 'DUPLICATE',
        },
      }).catch(() => {});
    }

    if (args.phase === 'crawl') {
      const successful = sourceStats.filter((x) => x.status === 'success' || x.status === 'partial').length;
      await db.researchRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          sourcesAttempted: sourceStats.length,
          sourcesSuccessful: successful,
          pagesVisited: sourceStats.reduce((a, x) => a + x.productPages + x.listingPages, 0),
          productPagesVisited: productPagesFetched,
          productsDiscovered: productsDiscoveredTotal,
          productsParsed: parsed.length,
          productsRejected: sourceStats.reduce((a, x) => a + x.productsRejected, 0),
          notes: 'crawl phase — build via --resume',
        },
      });
      log(`CRAWL PHASE COMPLETE: parsed=${parsed.length} productPages=${productPagesFetched} — run build with --resume=${runId}`);
      await db.$disconnect();
      return;
    }

    // ================= SELECTION (§57/§58) =================
    const selectable = canonical
      .filter((p) => (args.category ? p.assignment.category === args.category : true))
      .map((p) => ({ id: p.id, sourceKey: p.sourceKey, category: p.assignment.category, qualityScore: p.scores.qualityScore, priceEur: p.prices.amountEur, styleSlugs: p.assignment.styles, spaceSlugs: p.assignment.spaces }));
    const selection = selectDiverse(selectable);
    const selectedParsed = canonical.filter((p) => selection.selected.includes(p.id));
    log(`selection: ${selectedParsed.length} products across ${Object.keys(selection.categoryCounts).length} categories (limits caused ${selection.rejectedBecauseLimits} skips)`);

    // mark SELECTED
    for (const p of parsed) {
      const isSel = selection.selected.includes(p.id);
      if (isSel) {
        await db.researchProduct.update({ where: { id: p.id }, data: { status: 'SELECTED' } }).catch(() => {});
      }
    }

    // limit override (--limit=N caps final selection)
    const limited = args.limit && args.limit < selectedParsed.length ? selectedParsed.slice(0, args.limit) : selectedParsed;

    // ================= COPY + IMAGES + BUILD =================
    const demoProducts: DemoProductForImport[] = [];
    const categoryIndex: Record<string, number> = {};
    const usedSlugs = new Set<string>((await db.product.findMany({ select: { slug: true } })).map((x) => x.slug));

    const launchIds = pickTopLaunch(limited.map((p) => ({ id: p.id, sourceKey: p.sourceKey, category: p.assignment.category, qualityScore: p.scores.qualityScore, priceEur: p.prices.amountEur, styleSlugs: p.assignment.styles, spaceSlugs: p.assignment.spaces })), 10);
    const heroIds = pickHeroes(limited.map((p) => ({ id: p.id, sourceKey: p.sourceKey, category: p.assignment.category, qualityScore: p.scores.qualityScore, priceEur: p.prices.amountEur, styleSlugs: p.assignment.styles, spaceSlugs: p.assignment.spaces })), 15);
    const heroSet = new Set(heroIds.slice(0, Math.min(15, Math.floor(limited.length * 0.12))));

    for (const [i, p] of limited.entries()) {
      const cat = p.assignment.category;
      const idx = categoryIndex[cat] ?? 0;
      categoryIndex[cat] = idx + 1;

      const copy = await generateCopy({
        facts: {
          category: cat,
          categoryLabel: catLabel(cat),
          material: p.material,
          colour: p.colour,
          dimsText: p.dims.text,
          spaces: p.assignment.spaces,
          isElectrical: p.elec.electrical,
          isBattery: p.elec.battery,
          isOutdoor: p.outdoor,
          variantNames: p.page.variants.map((v) => v.name).filter(Boolean),
          typeHint: typeHintFromTitle(p.page.title ?? '', p.page.brand, p.colour, p.material),
        },
      });
      if ((i + 1) % 20 === 0) flushCopyCache();

      // slug (unique, stable)
      let slug = slugify(copy.name);
      if (usedSlugs.has(slug)) slug = `${slug}-${i + 1}`;
      while (usedSlugs.has(slug)) slug = `${slug}-x`;
      usedSlugs.add(slug);

      // public images from E-com.casa's own generated pool (never third-party hotlinks, §78)
      const pool = assignPublicImages(cat, idx, `${p.material ?? ''}${p.colour ?? ''}${cat}`);
      const variantNames = p.page.variants.map((v) => v.name).filter(Boolean);

      // variants (only genuinely extracted, §18)
      const variants: Array<Record<string, unknown>> = [];
      let vIdx = 0;
      for (const v of p.page.variants.slice(0, 8)) {
        const label = variantLabel(v.name, v.options);
        if (!label) continue;
        const type = variantType(label);
        const delta =
          v.price !== undefined && p.prices.amount !== null
            ? Math.round((parseFloat(v.price) - p.prices.amount) * 100)
            : 0;
        variants.push({
          id: `v${++vIdx}`,
          type,
          name: label,
          value: slugify(label),
          ...(delta !== 0 && Number.isFinite(delta) ? { priceDeltaCents: delta } : {}),
        });
      }

      // demo price (§35): calibrated from observed market price — separate from source pricing
      const demoPrice = demoPriceFromEur(p.prices.amountEur ?? 29);
      const priceCents = Math.round(demoPrice * 100);
      const isLaunch = launchIds.includes(p.id);
      const isHero = heroSet.has(p.id);

      demoProducts.push({
        researchId: p.id,
        sku: '', // assigned idempotently in importer
        slug,
        name: copy.name,
        subtitle: p.colour ? `${p.colour}${p.material ? ` · ${p.material}` : ''}` : p.material ?? null,
        shortDescription: copy.shortDescription,
        description: copy.description,
        price: demoPrice.toFixed(2),
        priceCents,
        comparePrice: null, // never fabricate discounts (§17)
        currency: 'EUR',
        categorySlug: cat,
        subcategorySlugs: p.assignment.subcategories.join(','),
        spaceSlugs: p.assignment.spaces.join(','),
        styleSlugs: p.assignment.styles.join(','),
        collectionSlugs: p.assignment.collections.join(','),
        image: pool.image,
        hoverImage: pool.hover ?? null,
        gallery: pool.gallery.join(','),
        imageStatus: 'GENERATED',
        badge: isLaunch ? 'Best Seller' : isHero ? "Editor's Pick" : i < 8 ? 'New' : null,
        featured: isHero,
        isBestSeller: isLaunch,
        isNew: i < 8,
        materials: p.material,
        dimensions: p.dims.text,
        weight: p.weight,
        care: p.page.care ? 'Care instructions observed in source research' : null,
        color: p.colour,
        shippingClass: inferShippingClass(cat, p.dims.text, p.material, p.elec.electrical),
        variantsJson: JSON.stringify(variants),
        electrical: p.elec.electrical,
        battery: p.elec.battery,
        marketObservedPrice: p.prices.amountEur,
        marketObservedCurrency: p.prices.currency,
        sourceDomain: new URL(p.url).hostname,
        sourceUrl: p.url,
        sourceKey: p.sourceKey,
      });

      // image validation + research-only download for selected products
      const validated = await validateGallery(p.sourceKey, p.page.gallery);
      const downloaded = await downloadResearchImages(p.sourceKey, slug, validated);
      for (const v of downloaded) {
        allImageRows.push({
          source: p.sourceKey,
          productUrl: p.url,
          imageUrl: v.record.sourceUrl,
          position: v.record.position,
          type: v.record.type,
          status: v.status,
          width: v.width !== undefined ? String(v.width) : '',
          height: v.height !== undefined ? String(v.height) : '',
          mime: v.mimeType ?? '',
          downloaded: v.status === 'DOWNLOADED',
          error: v.error ?? '',
        });
      }
      // record images in research DB
      for (const v of downloaded) {
        await db.researchImage.create({
          data: {
            researchProductId: p.id,
            sourceKey: p.sourceKey,
            sourceUrl: v.record.sourceUrl.slice(0, 900),
            normalizedUrl: v.record.sourceUrl.slice(0, 900),
            position: v.record.position,
            type: v.record.type,
            status: v.status,
            mimeType: v.mimeType,
            fileSize: v.fileSize,
            sha256: v.sha256,
            localPath: v.localPath,
            downloadedAt: v.status === 'DOWNLOADED' ? new Date() : null,
          },
        }).catch(() => {});
      }

      log(`built ${i + 1}/${limited.length}: ${copy.name.slice(0, 48)} · imgs ok=${downloaded.filter((v) => v.status === 'DOWNLOADED' || v.status === 'VALIDATED').length}/${downloaded.length}`);

    }

    // store market research metadata (§63) in ResearchProduct
    for (const p of limited) {
      await db.researchProduct.update({
        where: { id: p.id },
        data: {
          rawPriceText: p.page.rawPriceText,
          observedAt: new Date(),
          selectionRank: limited.findIndex((x) => x.id === p.id) + 1,
          completenessScore: p.scores.completeness,
          qualityScore: p.scores.qualityScore,
          extractionConfidence: p.scores.extractionConfidence,
          imageCount: p.page.gallery.length,
          variantCount: p.page.variants.length,
          countryFitJson: JSON.stringify(p.assignment.countryFit ?? {}),
        },
      }).catch(() => {});
    }
    flushCopyCache();

    // ================= IMPORT (§74/§75) =================
    const importOutcome = await importSelected(demoProducts, {
      dryRun: args.dryRun,
      retireSyntheticOnly: !args.category && !args.source, // only full runs retire the archetype fallback
    });
    log(`import: upserted=${importOutcome.upserted} retiredSynthetic=${importOutcome.retired} db=${importOutcome.dbConnected}`);

    // ================= RUN STATS =================
    const successfulSources = sourceStats.filter((s) => s.status === 'success' || s.status === 'partial').length;
    await db.researchRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sourcesAttempted: sourceStats.length,
        sourcesSuccessful: successfulSources,
        pagesVisited: sourceStats.reduce((a, s) => a + s.productPages + s.listingPages, 0),
        productPagesVisited: productPagesFetched,
        productsDiscovered: productsDiscoveredTotal,
        productsParsed: parsed.length,
        productsRejected: sourceStats.reduce((a, s) => a + s.productsRejected, 0),
        productsImported: importOutcome.upserted,
      },
    });

    // ================= REPORTS (§69–§73) =================
    const importedCopy = demoProducts.map((d) => ({ name: d.name, category: d.categorySlug, source: d.sourceKey, researchUrl: d.sourceUrl, sku: d.sku, price: `${d.price} EUR (demo) · observed ${d.marketObservedPrice ?? '?'} ${d.marketObservedCurrency ?? ''}` }));
    const productRows: ProductReportRow[] = parsed.map((p) => ({
      source: p.sourceKey,
      productUrl: p.url,
      productName: p.page.title ?? '',
      category: p.assignment.category,
      price: p.prices.amount !== null ? String(p.prices.amount) : '',
      currency: p.prices.currency,
      imageCount: p.page.gallery.length,
      variantCount: p.page.variants.length,
      descriptionPresent: Boolean(p.page.fullDescription || p.page.shortDescription),
      materialPresent: Boolean(p.material),
      dimensionsPresent: Boolean(p.dims.text),
      weightPresent: Boolean(p.weight),
      brandPresent: Boolean(p.page.brand),
      skuPresent: Boolean(p.page.sku),
      technicalSpecsPresent: Object.keys(p.elec.specs).length > 0,
      complianceDataPresent: Boolean(p.page.gtin || p.page.warnings?.length),
      completenessScore: p.scores.completeness,
      extractionConfidence: p.scores.extractionConfidence,
      status: selection.selected.includes(p.id) ? 'SELECTED' : dedupeResults.get(p.id)?.kind === 'EXACT_DUPLICATE' || dedupeResults.get(p.id)?.kind === 'LIKELY_DUPLICATE' ? 'DUPLICATE' : 'PARSED',
      origin: 'REAL_EXTRACTED',
    }));

    const missingRows: MissingDataRow[] = [];
    for (const p of parsed) {
      const add = (field: string, severity: string): void =>
        missingRows.push({ product: p.page.title ?? p.url, source: p.sourceKey, missingField: field, severity });
      if (!p.material) add('material', 'minor');
      if (!p.dims.text) add('dimensions', 'minor');
      if (!p.weight) add('weight', 'minor');
      if (!p.page.brand) add('brand', 'minor');
      if (!p.page.sku) add('sku', 'minor');
      if (!p.page.fullDescription && !p.page.shortDescription) add('description', 'major');
      if (p.page.gallery.length === 0) add('images', 'major');
      if (p.elec.electrical && Object.keys(p.elec.specs).length === 0) add('technicalSpecs', 'minor');
    }

    const topRows = [...parsed]
      .sort((a, b) => b.scores.qualityScore - a.scores.qualityScore)
      .slice(0, 30)
      .map((p) => ({
        product: p.page.title ?? '',
        source: p.sourceKey,
        category: p.assignment.category,
        researchScore: p.scores.qualityScore,
        completeness: p.scores.completeness,
        imageCount: p.page.gallery.length,
        price: p.prices.amount !== null ? `${p.prices.amount} ${p.prices.currency}` : '',
        bundlePotential: p.assignment.collections.join('/') || '—',
        visualScore: Math.min(100, p.page.gallery.length * 15 + (p.page.gallery.length > 0 ? 25 : 0)),
        commercialScore: Math.round(p.scores.qualityScore * 0.6 + (p.prices.amountEur !== null && p.prices.amountEur < 400 ? 20 : 0) + (p.assignment.category === 'lighting' ? 10 : 5)),
      }));

    const dataGaps: string[] = [];
    const blockedSources = sourceStats.filter((s) => s.status === 'blocked');
    if (blockedSources.length > 0) dataGaps.push(`Blocked sources (recorded honestly, not circumvented): ${blockedSources.map((s) => s.key).join(', ')}`);
    const failedSources = sourceStats.filter((s) => s.status === 'failed');
    if (failedSources.length > 0) dataGaps.push(`Failed sources: ${failedSources.map((s) => s.key).join(', ')}`);
    const noVariant = limited.filter((p) => p.page.variants.length === 0).length;
    dataGaps.push(`${noVariant}/${limited.length} selected products expose no public variants.`);
    const noDims = limited.filter((p) => !p.dims.text).length;
    if (noDims > 0) dataGaps.push(`${noDims}/${limited.length} selected products expose no dimensions.`);
    if (selectedParsed.length < V2_CONFIG.catalogue.target) dataGaps.push(`Selection is ${selectedParsed.length} of the 120 target — fewer products imported rather than fabricating unsupported ones (§58).`);

    const avgCompleteness = selectedParsed.length > 0 ? Math.round(selectedParsed.reduce((a, p) => a + p.scores.completeness, 0) / selectedParsed.length) : 0;

    writeReports({
      sourceRows: sourceStats.map((s) => ({ ...s, imagesValidated: allImageRows.filter((r) => r.source === s.key && r.status === 'VALIDATED').length, imagesDownloaded: allImageRows.filter((r) => r.source === s.key && r.downloaded).length, averageCompleteness: Math.round(parsed.filter((p) => p.sourceKey === s.key).reduce((a, p) => a + p.scores.completeness, 0) / Math.max(1, parsed.filter((p) => p.sourceKey === s.key).length)), errors: requestErrors.filter((e) => e.url.includes(s.key)).length })),
      productRows,
      imageRows: allImageRows,
      missingRows: missingRows.slice(0, 3000),
      topRows,
      runStats: {
        sourcesAttempted: sourceStats.length,
        sourcesSuccessful: successfulSources,
        sourcesBlocked: blockedSources.length,
        sourcesFailed: failedSources.length,
        pagesVisited: sourceStats.reduce((a, s) => a + s.productPages + s.listingPages, 0),
        productPages: productPagesFetched,
        productsDiscovered: productsDiscoveredTotal,
        productsParsed: parsed.length,
        duplicates: duplicateCount,
        rejected: sourceStats.reduce((a, s) => a + s.productsRejected, 0),
        selected: selectedParsed.length,
        imported: importOutcome.upserted,
        withSourceUrls: demoProducts.length,
        withImages: demoProducts.length, // every product carries a public demo image
        withPrices: demoProducts.filter((d) => d.marketObservedPrice !== null).length,
        withDescriptions: demoProducts.length,
        withVariants: demoProducts.filter((d) => JSON.parse(d.variantsJson).length > 0).length,
        withDimensions: limited.filter((p) => p.dims.text).length,
        withMaterial: limited.filter((p) => p.material).length,
        avgCompleteness,
      },
      copiedProducts: importedCopy,
      dataGaps,
      envRequired: ['DATABASE_URL (Neon PostgreSQL pooled connection string)'],
      buildStatus: 'PASS',
    });

    // ================= FINAL OUTPUT (§103) =================
    console.log(`
E-COM.CASA CATALOG SCRAPER V2 — RUN COMPLETE
Sources attempted: ${sourceStats.length}
Sources successful: ${successfulSources}
Sources blocked: ${blockedSources.length}
Sources failed: ${failedSources.length}

Pages visited: ${sourceStats.reduce((a, s) => a + s.productPages + s.listingPages, 0)}
Product pages: ${productPagesFetched}

Products discovered: ${productsDiscoveredTotal}
Products successfully extracted: ${parsed.length}
Duplicates: ${duplicateCount}
Rejected: ${sourceStats.reduce((a, s) => a + s.productsRejected, 0)}
Final selected: ${selectedParsed.length}
Imported: ${importOutcome.upserted} ${args.dryRun ? '(dry-run — nothing written)' : ''}

Products with images: ${demoProducts.length}
Products with descriptions: ${demoProducts.length}
Products with prices: ${demoProducts.filter((d) => d.marketObservedPrice !== null).length}
Products with variants: ${demoProducts.filter((d) => JSON.parse(d.variantsJson).length > 0).length}
Average completeness: ${avgCompleteness}

Top 10 launch products:
${launchIds.slice(0, 10).map((id) => { const p = parsed.find((x) => x.id === id); return `  - ${p?.page.title ?? id} (${p?.sourceKey})`; }).join('\n')}

Sources that failed: ${[...failedSources, ...blockedSources].map((s) => s.key).join(', ') || 'none'}

Data gaps: see ${V2_CONFIG.output.reportMd}
Reports: ${V2_CONFIG.output.reportMd}, ${V2_CONFIG.output.productQualityCsv}, ${V2_CONFIG.output.imageReportCsv}, ${V2_CONFIG.output.missingDataCsv}, ${V2_CONFIG.output.topProductsCsv}
  `);
  } catch (e) {
    await db.researchRun.update({ where: { id: runId }, data: { status: 'FAILED', completedAt: new Date(), errorsJson: JSON.stringify([{ message: (e as Error).message }]) } }).catch(() => {});
    throw e;
  } finally {
    await db.$disconnect();
  }
}

// ---------------- helpers ----------------

async function recordPage(
  db: PrismaClient,
  runId: string,
  sourceKey: string,
  url: string,
  res: { statusCode?: number; contentType?: string; body?: string; finalUrl?: string },
  pageType: string,
): Promise<{ id: string }> {
  const { createHash } = await import('node:crypto');
  const { default: cheerio } = await import('cheerio');
  let title: string | undefined;
  let canonicalUrl: string | undefined;
  if (res.body) {
    try {
      const $ = cheerio.load(res.body.slice(0, 400_000));
      title = $('title').first().text().trim().slice(0, 300) || undefined;
      canonicalUrl = $('link[rel="canonical"]').attr('href') || undefined;
    } catch {
      /* ignore */
    }
  }
  const rec = await db.researchPage.upsert({
    where: { researchRunId_url: { researchRunId: runId, url } },
    create: {
      researchRunId: runId,
      sourceKey,
      url: url.slice(0, 900),
      canonicalUrl: canonicalUrl?.slice(0, 900),
      pageType,
      httpStatus: res.statusCode,
      contentType: res.contentType?.slice(0, 120),
      title,
      contentHash: res.body ? createHash('sha256').update(res.body).digest('hex').slice(0, 32) : undefined,
      bytes: res.body?.length,
    },
    update: { httpStatus: res.statusCode, pageType, title, fetchedAt: new Date() },
  });
  return { id: rec.id };
}

async function recordError(
  db: PrismaClient,
  runId: string,
  sourceKey: string | null,
  url: string | null,
  stage: string,
  errorType: string,
  message: string,
): Promise<void> {
  await db.researchError.create({
    data: { researchRunId: runId, sourceKey, url: url?.slice(0, 900), stage, errorType, message: message.slice(0, 500) },
  }).catch(() => {});
}

async function persistResearchProduct(db: PrismaClient, runId: string, sourceKey: string, pageId: string, p: ParsedProduct): Promise<void> {
  // ResearchProduct row is created here; evidence/attributes/variants/images follow
  const rec = await db.researchProduct.upsert({
    where: { id: p.id },
    create: {
      id: p.id,
      researchRunId: runId,
      pageId,
      sourceUrl: p.url.slice(0, 900),
      canonicalUrl: p.page.canonicalUrl?.slice(0, 900),
      sourceProductId: p.page.sourceProductId?.slice(0, 120),
      sourceProductName: (p.page.title ?? 'unknown').slice(0, 300),
      sourceBrand: p.page.brand?.slice(0, 120),
      sourceCategory: p.page.category?.slice(0, 120) ?? p.page.breadcrumbs?.join(' > ').slice(0, 250),
      sourceSubcategory: p.page.subcategory?.slice(0, 120),
      sourcePrice: p.prices.amount !== null ? String(p.prices.amount) : null,
      sourceCurrency: p.prices.currency,
      sourceSalePrice: p.prices.salePriceEur !== null ? String(p.prices.salePriceEur) : null,
      sourceAvailability: p.page.availability?.slice(0, 40),
      sourceSku: p.page.sku?.slice(0, 80),
      sourceMpn: p.page.mpn?.slice(0, 80),
      sourceEan: p.page.ean,
      sourceGtin: p.page.gtin,
      sourceDescription: (p.page.fullDescription ?? p.page.shortDescription ?? '').slice(0, 1000),
      sourceMaterials: p.material,
      sourceColours: p.colour,
      sourceDimensions: p.dims.text,
      sourceWeight: p.weight,
      sourceAttributes: JSON.stringify(Object.fromEntries(p.specs.slice(0, 40).map((s) => [s.key, s.sourceValue]))),
      sourceImageUrls: JSON.stringify(p.page.gallery.slice(0, 24).map((g) => g.sourceUrl)),
      sourceDataJson: JSON.stringify({
        dominantMethod: p.page.dominantMethod,
        signals: p.page.productSignals.slice(0, 8),
        specs: p.specs.slice(0, 20).map((s) => ({ key: s.key, value: s.sourceValue, nk: s.normalizedKey, conf: s.confidence })),
        electricalSpecs: p.elec.specs,
        breadcrumbs: p.page.breadcrumbs?.slice(0, 8),
        reviewCount: p.page.reviewCount, // research-only metadata (no review text, §9)
      }),
      productFingerprint: `${p.sourceKey}::${(p.page.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`,
      researchScore: p.scores.qualityScore,
      scoreBreakdownJson: JSON.stringify(p.scores),
      extractionMethod: p.page.dominantMethod,
      extractionConfidence: p.scores.extractionConfidence,
      completenessScore: p.scores.completeness,
      qualityScore: p.scores.qualityScore,
      imageCount: p.page.gallery.length,
      variantCount: p.page.variants.length,
      status: 'PARSED',
    },
    update: {},
  });

  // evidence (§21) — audit trail for the important fields
  const evidence: Array<{ field: string; value: string; method: string; selector?: string; confidence: number }> = [];
  const em = p.page.fieldMethods;
  if (p.page.title) evidence.push({ field: 'productName', value: p.page.title.slice(0, 200), method: em.title ?? 'html', confidence: 0.9 });
  if (p.prices.amount !== null) evidence.push({ field: 'price', value: `${p.prices.amount} ${p.prices.currency} (raw: ${p.page.rawPriceText ?? '?'})`, method: em.price ?? 'json-ld', confidence: 0.95 });
  if (p.page.sku) evidence.push({ field: 'sku', value: p.page.sku, method: em.sku ?? 'html', confidence: 0.85 });
  if (p.page.brand) evidence.push({ field: 'brand', value: p.page.brand, method: em.brand ?? 'html', confidence: 0.85 });
  if (p.dims.text) evidence.push({ field: 'dimensions', value: p.dims.text.slice(0, 160), method: em.dimensions ?? 'html', confidence: 0.8 });
  if (p.material) evidence.push({ field: 'material', value: p.material, method: 'html', confidence: 0.75 });
  if (p.page.gallery[0]) evidence.push({ field: 'primaryImage', value: p.page.gallery[0].sourceUrl.slice(0, 300), method: p.page.gallery[0].method, confidence: 0.9 });
  if (p.page.variants.length > 0) evidence.push({ field: 'variants', value: `${p.page.variants.length} variants`, method: 'embedded-json', confidence: 0.85 });
  if (evidence.length > 0) {
    await db.researchEvidence.createMany({
      data: evidence.map((e) => ({
        researchProductId: rec.id,
        field: e.field,
        value: e.value.slice(0, 400),
        sourceUrl: p.url.slice(0, 900),
        method: e.method,
        selector: e.selector,
        confidence: e.confidence,
      })),
    }).catch(() => {});
  }

  // attributes (§19)
  if (p.specs.length > 0) {
    await db.researchAttribute.createMany({
      data: p.specs.slice(0, 40).map((s) => ({
        researchProductId: rec.id,
        fieldKey: s.key.slice(0, 80),
        sourceValue: s.sourceValue.slice(0, 300),
        normalizedKey: s.normalizedKey,
        normalizedValue: s.normalizedValue?.slice(0, 200),
        confidence: s.confidence,
      })),
    }).catch(() => {});
  }

  // variants (§18)
  if (p.page.variants.length > 0) {
    await db.researchVariant.createMany({
      data: p.page.variants.slice(0, 20).map((v) => ({
        researchProductId: rec.id,
        sourceVariantId: v.sourceVariantId?.slice(0, 120),
        name: v.name.slice(0, 160),
        optionsJson: v.options ? JSON.stringify(v.options) : null,
        sku: v.sku?.slice(0, 80),
        price: v.price,
        currency: v.currency,
        availability: v.availability,
        attributesJson: v.attributes ? JSON.stringify(v.attributes) : null,
        imageUrlsJson: v.imageUrls ? JSON.stringify(v.imageUrls.slice(0, 6)) : null,
      })),
    }).catch(() => {});
  }
}

function catLabel(cat: string): string {
  return (
    {
      lighting: 'lighting piece',
      'wall-panels': 'wall panel',
      decoration: 'interior decoration piece',
      garden: 'garden piece',
      outdoor: 'outdoor living piece',
      planters: 'planter',
      'outdoor-privacy': 'outdoor privacy screen',
      organisation: 'storage and organisation piece',
      'kitchen-dining': 'kitchen and dining piece',
      'gadgets-smart-home': 'smart home gadget',
      accessories: 'home accessory',
    } as Record<string, string>
  )[cat] ?? 'home piece';
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product';
}

/** Object-type noun phrase from the source product title — strips brands, colours,
 *  materials and marketing noise so the LLM names stay original but distinct (§32). */
function typeHintFromTitle(title: string, brand?: string, colour?: string | null, material?: string | null): string | undefined {
  let t = title.toLowerCase();
  if (brand) t = t.split(brand.toLowerCase()).join(' ');
  const noise = new Set([...(colour ? colour.toLowerCase().split(/\s|\//) : []), ...(material ? material.toLowerCase().split(/\s|\//) : []), 'the', 'a', 'an', 'with', 'and', 'for', 'in', 'of', 'set', 'pack', 'of', 'cm', 'mm', 'x', 'small', 'large', 'medium', 'mini', 'maxi', 'classic', 'new', 'pair']);
  const words = t.replace(/[^a-z0-9à-ú\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !noise.has(w) && !/^\d+$/.test(w));
  if (words.length === 0) return undefined;
  return words.slice(-3).join(' ');
}

function variantLabel(name: string | undefined, options: Record<string, string> | undefined): string | null {
  const raw = name ?? (options ? Object.values(options).join(' / ') : '');
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 40 || /^(default|standard|one size)$/i.test(clean)) return null;
  return clean;
}

function variantType(label: string): 'colour' | 'size' | 'pack' {
  if (/set|pack|piece|kit/i.test(label)) return 'pack';
  if (/\d+\s?(cm|mm|m|ml|l\b|in)/i.test(label)) return 'size';
  return 'colour';
}

function demoPriceFromEur(observedEur: number): number {
  if (!Number.isFinite(observedEur) || observedEur <= 0) return 19.9;
  const floor = Math.floor(observedEur);
  const frac = observedEur - floor;
  const demo = frac > 0.15 ? floor + 0.9 : Math.max(floor - 0.1, 0.9);
  return Math.min(4990, Math.max(4.9, demo));
}

// ---------------- resume hydration (§93) ----------------

function sourceKeyFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const match = SOURCES_V2.find((s) => host === s.domain || host.endsWith(`.${s.domain}`) || s.domain === host);
    return match?.key ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

interface HydrationResult {
  products: ParsedProduct[];
  sourceStats: SourceStat[];
  productPages: number;
  discovered: number;
}

/** Rebuilds ParsedProduct records from the persisted research layer so a resumed
 *  run goes straight to dedupe/selection/build without re-crawling (§93). */
async function hydrateFromRun(db: PrismaClient, runIds: string[]): Promise<HydrationResult> {
  const rowsAll = await db.researchProduct.findMany({
    where: { researchRunId: { in: runIds }, status: { in: ['PARSED', 'NORMALIZED', 'SELECTED', 'IMPORTED'] } },
  });
  // cross-run safety dedupe by sourceUrl (global visited-skip makes this rare)
  const seenUrls = new Set<string>();
  const rows = rowsAll.filter((r) => {
    const key = r.canonicalUrl ?? r.sourceUrl;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });
  const pageRows = await db.researchPage.findMany({ where: { researchRunId: { in: runIds }, pageType: 'PRODUCT' }, select: { id: true, url: true, httpStatus: true, errorJson: true } });
  const variantRows = await db.researchVariant.findMany({ where: { researchProductId: { in: rows.map((r) => r.id) } } });
  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.researchProductId) ?? [];
    list.push(v);
    variantsByProduct.set(v.researchProductId, list);
  }

  // rebuild per-source stats from persisted pages
  const pageBySource = new Map<string, SourceStat>();
  for (const pr of pageRows) {
    const key = sourceKeyFromUrl(pr.url);
    const stat = pageBySource.get(key) ?? {
      key, robotsStatus: 'OK (resumed)', seedUrls: 0, sitemapsProcessed: 0, listingPages: 0,
      productPages: 0, successfulPages: 0, blockedPages: 0, failedPages: 0,
      productsDiscovered: 0, productsParsed: 0, productsAccepted: 0, productsRejected: 0, imagesFound: 0, status: 'partial' as const,
    };
    stat.productPages++;
    if (pr.httpStatus === 200) stat.successfulPages++;
    else if (pr.httpStatus === 403 || pr.httpStatus === 429) stat.blockedPages++;
    else stat.failedPages++;
    pageBySource.set(key, stat);
  }

  const products: ParsedProduct[] = [];
  for (const r of rows) {
    let sourceData: Record<string, unknown> = {};
    try {
      sourceData = JSON.parse(r.sourceDataJson ?? '{}') as Record<string, unknown>;
    } catch {
      /* empty */
    }
    let attrs: Record<string, string> = {};
    try {
      attrs = JSON.parse(r.sourceAttributes ?? '{}') as Record<string, string>;
    } catch {
      /* empty */
    }
    let imageUrls: string[] = [];
    try {
      imageUrls = JSON.parse(r.sourceImageUrls ?? '[]') as string[];
    } catch {
      /* empty */
    }
    const specs: ParsedProduct['specs'] = Object.entries(attrs).slice(0, 40).map(([key, value]) => ({
      key,
      sourceValue: String(value).slice(0, 200),
      confidence: 0.75,
      method: 'html' as const,
    }));

    const page: ExtractedPage = {
      url: r.sourceUrl,
      canonicalUrl: r.canonicalUrl ?? undefined,
      isProduct: true,
      productSignals: (sourceData.signals as string[] | undefined) ?? ['resumed'],
      title: r.sourceProductName,
      shortDescription: r.sourceDescription?.slice(0, 300),
      fullDescription: r.sourceDescription ?? undefined,
      brand: r.sourceBrand ?? undefined,
      sku: r.sourceSku ?? undefined,
      mpn: r.sourceMpn ?? undefined,
      ean: r.sourceEan ?? undefined,
      gtin: r.sourceGtin ?? undefined,
      sourceProductId: r.sourceProductId ?? undefined,
      rawPriceText: r.rawPriceText ?? undefined,
      priceAmount: r.sourcePrice !== null ? parseFloat(r.sourcePrice) : undefined,
      priceCurrency: r.sourceCurrency ?? undefined,
      salePriceAmount: r.sourceSalePrice !== null ? parseFloat(r.sourceSalePrice) : undefined,
      availability: r.sourceAvailability ?? undefined,
      breadcrumbs: (sourceData.breadcrumbs as string[] | undefined) ?? undefined,
      category: r.sourceCategory ?? undefined,
      variants: (variantsByProduct.get(r.id) ?? []).map((v) => ({
        sourceVariantId: v.sourceVariantId ?? undefined,
        name: v.name,
        options: v.optionsJson ? (JSON.parse(v.optionsJson) as Record<string, string>) : undefined,
        sku: v.sku ?? undefined,
        price: v.price ?? undefined,
        currency: v.currency ?? undefined,
        availability: v.availability ?? undefined,
      })),
      gallery: imageUrls.map((u, i) => ({ sourceUrl: u, position: i, type: i === 0 ? ('primary' as const) : ('gallery' as const), method: 'html' as const })),
      specs,
      material: r.sourceMaterials ?? undefined,
      colour: r.sourceColours ?? undefined,
      dimensions: r.sourceDimensions ?? undefined,
      weight: r.sourceWeight ?? undefined,
      care: undefined,
      electrical: false,
      battery: false,
      electricalSpecs: (sourceData.electricalSpecs as Record<string, string> | undefined) ?? {},
      fieldMethods: { title: 'json-ld', price: 'json-ld' },
      dominantMethod: (r.extractionMethod as ExtractedPage['dominantMethod']) ?? 'json-ld',
    };

    const sourceKey = sourceKeyFromUrl(r.sourceUrl);
    const defaultCurrency = getSourceV2(sourceKey)?.defaultCurrency ?? 'EUR';
    const prices = normalizePrice(page, defaultCurrency);
    if (prices.amount === null) continue;

    const elec = detectElectrical(page);
    const assignment = mapCatalogFields(page, {});
    const scores = scoreProduct(page, assignment.category, elec);
    const dims: ParsedProduct['dims'] = { text: r.sourceDimensions };

    products.push({
      id: r.id,
      sourceKey,
      url: r.sourceUrl,
      page,
      prices,
      dims,
      weight: r.sourceWeight,
      material: r.sourceMaterials,
      colour: r.sourceColours,
      specs,
      elec,
      outdoor: detectOutdoorUse(page),
      assignment,
      scores,
    });

    const stat = pageBySource.get(sourceKey);
    if (stat) {
      stat.productsDiscovered++;
      stat.productsParsed++;
      stat.productsAccepted++;
      stat.imagesFound += page.gallery.length;
    }
  }

  return {
    products,
    sourceStats: [...pageBySource.values()],
    productPages: pageRows.length,
    discovered: rows.length,
  };
}

main().catch((e) => {
  console.error('[scrape-v2] FATAL:', e);
  process.exit(1);
});
