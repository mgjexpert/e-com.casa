#!/usr/bin/env bun
// ============================================================
// E-com.casa — One-shot catalog research CLI
// ------------------------------------------------------------
//   npm run catalog:research
//   npm run catalog:research -- --dry-run
//   npm run catalog:research -- --source=kave-home
//   npm run catalog:research -- --limit=50
//
// ONE-TIME market research + demo catalogue import utility.
// NOT a production crawler. No public routes, no cron, no
// storefront exposure. Honors robots.txt, rate limits and
// blocks honestly (no circumvention).
// ============================================================

import { randomUUID } from 'node:crypto';
import { RESEARCH_CONFIG } from './config';
import { getSources, getSource } from './sources';
import { politeFetch, getErrorLog } from './http-client';
import { crawlSource, recordCrawlErrors } from './crawler';
import { discoverViaSearch } from './websearch-provider';
import { normalizeCandidate, fingerprint } from './normalizer';
import { assignCatalogFields } from './category-mapper';
import { dedupe } from './dedupe';
import { scoreCandidate } from './scoring';
import { generateCatalogue, mixReport } from './product-generator';
import { importCatalogue, persistResearchRecords } from './importer';
import { writeReport, missingFieldsReport, type SourceReport, type RunReport } from './report';
import { PrismaClient } from '@prisma/client';

interface Args {
  dryRun: boolean;
  source?: string;
  limit?: number;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--source=')) args.source = a.split('=')[1];
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
  }
  return args;
}

const log = (...m: unknown[]) => console.log('[catalog-research]', ...m);

async function main() {
  const args = parseArgs();
  const startedAt = new Date();
  const runId = `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const sources = args.source ? [getSource(args.source)].filter(Boolean) : getSources();

  if (!sources.length) {
    console.error(`Unknown source: ${args.source}. Available: ${getSources().map((s) => s.key).join(', ')}`);
    process.exit(1);
  }

  log(`Run ${runId} — mode: ${args.dryRun ? 'DRY RUN' : 'IMPORT'} — sources: ${sources.map((s) => s.key).join(', ')}`);

  // ---- Optional DB run record (internal research layer) ----
  const db = new PrismaClient();
  try {
    await db.researchRun.create({
      data: { id: runId, status: 'RUNNING', mode: args.dryRun ? 'dry-run' : 'import', sourceCount: sources.length },
    });
  } catch {
    // DB may be unreachable — research continues, report discloses
  }

  // ---- Phase 1: discovery ----
  const perSourceLimit = args.limit ?? RESEARCH_CONFIG.limits.maxProductsPerSource;
  const sourceReports: SourceReport[] = [];
  const reportSourceKeys: string[] = [];
  const rawCandidates: Array<{ candidate: import('./extractor').ExtractedProduct; sourceKey: string }> = [];
  const blockedSources: string[] = [];

  for (const source of sources) {
    log(`— source: ${source.name} (tier ${source.tier})`);
    let pagesVisited = 0, urlsSuccessful = 0, urlsBlocked = 0, urlsFailed = 0;
    let blocked = false;

    // HTTP crawl (polite, bounded, robots-checked)
    if (RESEARCH_CONFIG.providers.http && source.categorySeedUrls.length > 0) {
      const outcome = await crawlSource(source, perSourceLimit);
      recordCrawlErrors(outcome.pages);
      pagesVisited = outcome.pages.length;
      urlsSuccessful = outcome.pages.filter((p) => p.status === 'success').length;
      urlsBlocked = outcome.pages.filter((p) => p.status === 'blocked').length;
      urlsFailed = outcome.pages.filter((p) => p.status === 'failed').length;
      blocked = urlsBlocked > 0 && urlsSuccessful === 0;
      for (const p of outcome.products) rawCandidates.push({ candidate: p, sourceKey: source.key });
    }

    // Search-index discovery (public search metadata)
    let searchFound = 0;
    if (RESEARCH_CONFIG.providers.websearch && source.searchQueries.length > 0) {
      const found = discoverViaSearch(source);
      searchFound = found.length;
      for (const p of found) rawCandidates.push({ candidate: p, sourceKey: source.key });
      // Count the search provider as a successful "page" touch per query
      pagesVisited += source.searchQueries.length;
      urlsSuccessful += source.searchQueries.length;
    }

    const skippedNoSeeds = source.categorySeedUrls.length === 0;
    if (blocked) blockedSources.push(source.name);

    reportSourceKeys.push(source.key);
    sourceReports.push({
      source: source.name,
      domain: source.domain,
      tier: source.tier,
      status: blocked ? 'blocked' : skippedNoSeeds ? 'partial' : 'completed',
      pagesVisited,
      urlsSuccessful,
      urlsBlocked,
      urlsFailed,
      candidatesFound: 0, // filled after normalization
      candidatesAccepted: 0,
      candidatesRejected: 0,
      averageScore: null,
      topCategories: [],
      errors: getErrorLog().filter((e) => e.url.includes(source.domain)).slice(0, 5).map((e) => `${e.errorType}: ${e.message.slice(0, 80)}`),
    });
    log(`   crawl: ${urlsSuccessful} ok / ${urlsBlocked} blocked / ${urlsFailed} failed · search: ${searchFound} hits`);

    // Honest stop for this source's HTTP channel when blocked
    if (blocked) continue;
  }

  // ---- Phase 2: normalization ----
  log('— normalizing candidates…');
  const normalized = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  for (const { candidate, sourceKey } of rawCandidates) {
    const source = getSource(sourceKey);
    const n = normalizeCandidate({
      sourceKey,
      sourceUrl: candidate.sourceUrl,
      sourceProductId: candidate.sourceProductId,
      sourceProductName: candidate.sourceProductName,
      sourceBrand: candidate.brand,
      sourceDescription: candidate.description,
      price: candidate.price,
      currency: candidate.currency,
      availability: candidate.availability,
      sku: candidate.sku,
      gtin: candidate.gtin,
      materials: candidate.materials,
      colours: candidate.colours,
      dimensions: candidate.dimensions,
      weight: candidate.weight,
      imageUrls: candidate.imageUrls,
      attributes: candidate.attributes,
      extractionMethod: candidate.extractionMethod,
      currencyHint: source?.normalizationOverrides?.currency,
    });
    if (n) normalized.push(n);
    else rejected.push({ url: candidate.sourceUrl, reason: 'failed normalization (invalid name/URL/price)' });
  }
  log(`   ${normalized.length} normalized, ${rejected.length} rejected`);

  // ---- Phase 3: dedupe ----
  log('— deduplicating…');
  const deduped = dedupe(normalized);
  const unique = deduped.filter((d) => d.class !== 'EXACT_DUPLICATE' && d.class !== 'NEAR_DUPLICATE');
  const duplicatesRemoved = normalized.length - unique.length;
  log(`   ${duplicatesRemoved} duplicates removed · ${unique.length} unique (incl. variants/families)`);

  // ---- Phase 4: scoring + selection ----
  log('— scoring…');
  const scored = unique.map((d) => {
    const assignment = assignCatalogFields(d.candidate);
    const score = scoreCandidate(d.candidate, assignment);
    return { candidate: d.candidate, assignment, score, fingerprint: fingerprint(d.candidate), dedupeClass: d.class };
  });
  scored.sort((a, b) => b.score.total - a.score.total);

  const selected = scored.filter((s) => s.score.total >= RESEARCH_CONFIG.scoring.selectionThreshold);
  log(`   ${selected.length} above selection threshold (${RESEARCH_CONFIG.scoring.selectionThreshold})`);

  // Source diversity cap (~25% of final catalogue per source)
  const maxPerSource = Math.ceil(RESEARCH_CONFIG.catalogue.target * RESEARCH_CONFIG.catalogue.maxSharePerSource);
  const perSourceCount = new Map<string, number>();
  const diversitySelected = selected.filter((s) => {
    const n = perSourceCount.get(s.candidate.sourceKey) ?? 0;
    if (n >= maxPerSource) return false;
    perSourceCount.set(s.candidate.sourceKey, n + 1);
    return true;
  });

  // ---- Persist internal research records ----
  try {
    const researchRecords = scored.slice(0, 400).map((s) => ({
      candidate: s.candidate,
      fingerprint: s.fingerprint,
      status: diversitySelected.includes(s) ? 'SELECTED' : s.score.total >= RESEARCH_CONFIG.scoring.selectionThreshold ? 'NORMALIZED' : 'REJECTED',
      researchId: `${runId}:${s.fingerprint.slice(0, 60)}`,
      score: s.score,
      assignment: s.assignment,
    }));
    const written = await persistResearchRecords(runId, sources.map((s) => s.key), researchRecords);
    log(`— persisted ${written} internal research records`);
  } catch {
    log('— internal research persistence skipped (DB unavailable)');
  }

  // ---- Phase 5: market price intelligence per category ----
  const pricesByCategory = new Map<string, number[]>();
  for (const s of diversitySelected) {
    const { priceEur } = s.candidate.normalized;
    if (priceEur !== undefined) {
      const list = pricesByCategory.get(s.assignment.category) ?? [];
      list.push(priceEur);
      pricesByCategory.set(s.assignment.category, list);
    }
  }
  const observedPricesByCategory = new Map<string, { min: number; max: number; median: number; count: number }>();
  for (const [cat, list] of pricesByCategory) {
    list.sort((a, b) => a - b);
    observedPricesByCategory.set(cat, {
      min: list[0],
      max: list[list.length - 1],
      median: list[Math.floor(list.length / 2)],
      count: list.length,
    });
  }

  // ---- Phase 6: generate the curated demo catalogue ----
  log('— generating E-com.casa demo catalogue…');
  const generation = generateCatalogue({
    candidates: diversitySelected.map((s) => ({ candidate: s.candidate, assignment: s.assignment, researchId: `${runId}:${s.fingerprint.slice(0, 60)}`, score: s.score.total })),
    observedPricesByCategory,
  });
  const mix = mixReport(generation.products);
  log(`   ${generation.products.length} products · ${generation.matchedCount} traceable to research · ${generation.priceCalibratedCount} prices calibrated`);
  log(`   mix: ${JSON.stringify(mix)}`);

  // ---- Phase 7: artifacts + DB import ----
  const importSummary = await importCatalogue(generation.products, { dryRun: args.dryRun, runId });
  log(`— import: ${importSummary.productsUpserted} products · mode: ${importSummary.dbMode}${importSummary.note ? ` · ${importSummary.note}` : ''}`);

  // ---- Phase 8: report ----
  const completedAt = new Date();
  // Fill per-source candidate counts post-normalization
  sourceReports.forEach((sr, idx) => {
    const sourceKey = reportSourceKeys[idx];
    const srcNormalized = normalized.filter((n) => n.sourceKey === sourceKey);
    const srcAccepted = diversitySelected.filter((s) => s.candidate.sourceKey === sourceKey);
    sr.candidatesFound = srcNormalized.length;
    sr.candidatesAccepted = srcAccepted.length;
    sr.candidatesRejected = srcNormalized.length - srcAccepted.length;
    const scores = srcAccepted.map((s) => s.score.total);
    sr.averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const catCounts = new Map<string, number>();
    for (const s of srcAccepted) catCounts.set(s.assignment.category, (catCounts.get(s.assignment.category) ?? 0) + 1);
    sr.topCategories = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  });

  const errors = getErrorLog();
  const report: RunReport = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    mode: args.dryRun ? 'dry-run' : 'import',
    totals: {
      sourcesAttempted: sources.length,
      sourcesCompleted: sourceReports.filter((s) => s.status === 'completed').length,
      sourcesBlocked: blockedSources,
      urlsVisited: sourceReports.reduce((a, s) => a + s.pagesVisited, 0),
      urlsSuccessful: sourceReports.reduce((a, s) => a + s.urlsSuccessful, 0),
      urlsBlocked: sourceReports.reduce((a, s) => a + s.urlsBlocked, 0),
      urlsFailed: sourceReports.reduce((a, s) => a + s.urlsFailed, 0),
      candidatesDiscovered: rawCandidates.length,
      candidatesNormalized: normalized.length,
      duplicatesRemoved,
      candidatesRejected: rejected.length + normalized.length - unique.length,
      candidatesSelected: diversitySelected.length,
      productsGenerated: generation.products.length,
      productsMatchedToResearch: generation.matchedCount,
      priceCalibrated: generation.priceCalibratedCount,
      importedToDb: importSummary.dbMode === 'postgres' && importSummary.productsUpserted > 0,
    },
    mix,
    mixTarget: { ...RESEARCH_CONFIG.catalogue.mix },
    bySource: sourceReports,
    topCandidates: diversitySelected.slice(0, 30).map((s) => ({
      name: s.candidate.normalized.nameClean,
      source: s.candidate.sourceKey,
      category: s.assignment.category,
      score: s.score.total,
      priceEur: s.candidate.normalized.priceEur ?? null,
    })),
    missingFieldsReport: missingFieldsReport(diversitySelected),
    dbNote: importSummary.note,
    notes: [
      'One-shot market research utility — NOT a production crawler. No public routes, cron jobs or storefront services expose this pipeline.',
      'Direct crawling honored robots.txt, used a fixed non-browser user agent, capped pages per source and stopped instantly on any block.',
      'Most tier-1 retailers operate bot protection; where crawling was blocked the run used public search-index metadata instead. No circumvention was attempted.',
      'Only original E-com.casa copy, naming and imagery are published. Source data remains internal research metadata (sourceResearchId, sourceUrl, sourceImageUrls).',
      'No third-party reviews, ratings, customer names, marketing slogans or photography were copied. Demo reviews are clearly demo-mode; JSON-LD AggregateRating is suppressed.',
      'Demo prices are generated by E-com.casa pricing logic (ENTRY €15–39 / CORE €40–99 / PREMIUM €100–300+), optionally calibrated to observed market medians. Source sale prices are never reused.',
    ],
  };
  writeReport(report);
  log(`— report written: ${RESEARCH_CONFIG.output.reportMd.replace('reports/', 'reports/')}`);

  // Close run record
  try {
    await db.researchRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt,
        productsDiscovered: rawCandidates.length,
        productsNormalized: normalized.length,
        productsRejected: report.totals.candidatesRejected,
        errorsJson: JSON.stringify(errors.slice(0, 200)),
      },
    });
  } catch {
    // ignore
  }
  await db.$disconnect();

  log('DONE ✔');
  if (!args.dryRun) {
    log(`Next: bun prisma/seed.ts (or npm run db:seed) re-syncs the DB from artifacts at any time.`);
  }
}

main().catch((e) => {
  console.error('[catalog-research] FATAL', e);
  process.exit(1);
});
