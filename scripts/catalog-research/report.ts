// ============================================================
// E-com.casa — Research run report
// (reports/catalog-research-report.json + .md)
// ============================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RESEARCH_CONFIG } from './config';
import type { RequestError } from './http-client';
import type { GeneratedProduct } from './product-generator';

export interface SourceReport {
  source: string;
  domain: string;
  tier: number;
  status: 'completed' | 'blocked' | 'partial' | 'skipped';
  pagesVisited: number;
  urlsSuccessful: number;
  urlsBlocked: number;
  urlsFailed: number;
  candidatesFound: number;
  candidatesAccepted: number;
  candidatesRejected: number;
  averageScore: number | null;
  topCategories: string[];
  errors: string[];
}

export interface RunReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  mode: 'import' | 'dry-run';
  totals: {
    sourcesAttempted: number;
    sourcesCompleted: number;
    sourcesBlocked: string[];
    urlsVisited: number;
    urlsSuccessful: number;
    urlsBlocked: number;
    urlsFailed: number;
    candidatesDiscovered: number;
    candidatesNormalized: number;
    duplicatesRemoved: number;
    candidatesRejected: number;
    candidatesSelected: number;
    productsGenerated: number;
    productsMatchedToResearch: number;
    priceCalibrated: number;
    importedToDb: boolean;
  };
  mix: Record<string, number>;
  mixTarget: Record<string, number>;
  bySource: SourceReport[];
  topCandidates: Array<{ name: string; source: string; category: string; score: number; priceEur: number | null }>;
  missingFieldsReport: Record<string, number>;
  dbNote?: string;
  notes: string[];
}

export function writeReport(report: RunReport): void {
  const jsonPath = path.join(process.cwd(), RESEARCH_CONFIG.output.reportJson);
  const mdPath = path.join(process.cwd(), RESEARCH_CONFIG.output.reportMd);
  mkdirSync(path.dirname(jsonPath), { recursive: true });

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  writeFileSync(mdPath, renderMarkdown(report), 'utf-8');
}

function renderMarkdown(r: RunReport): string {
  const lines: string[] = [];
  lines.push('# E-com.casa — Catalog Research Report', '');
  lines.push(`**Run ID:** ${r.runId}  `);
  lines.push(`**Mode:** ${r.mode}  `);
  lines.push(`**Started:** ${r.startedAt}  `);
  lines.push(`**Completed:** ${r.completedAt}  `);
  lines.push(`**Duration:** ${(r.durationMs / 1000).toFixed(1)}s`, '');

  lines.push('## Totals', '');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  const t = r.totals;
  const rows: Array<[string, string | number]> = [
    ['Sources attempted', t.sourcesAttempted],
    ['Sources completed', t.sourcesCompleted],
    ['Sources blocked (disclosed)', t.sourcesBlocked.length ? t.sourcesBlocked.join(', ') : 'none'],
    ['URLs visited', t.urlsVisited],
    ['URLs successful', t.urlsSuccessful],
    ['URLs blocked', t.urlsBlocked],
    ['URLs failed', t.urlsFailed],
    ['Candidate products discovered', t.candidatesDiscovered],
    ['Candidates normalized', t.candidatesNormalized],
    ['Duplicates removed', t.duplicatesRemoved],
    ['Candidates rejected', t.candidatesRejected],
    ['Candidates selected', t.candidatesSelected],
    ['E-com.casa products generated', t.productsGenerated],
    ['Products traceable to research', t.productsMatchedToResearch],
    ['Prices calibrated from market data', t.priceCalibrated],
    ['Imported to PostgreSQL', t.importedToDb ? 'yes' : 'no (artifacts only — run db:seed)'],
  ];
  for (const [k, v] of rows) lines.push(`| ${k} | ${v} |`);
  lines.push('');

  lines.push('## Catalogue mix', '');
  lines.push(`| Category | Generated | Target |`);
  lines.push(`| --- | --- | --- |`);
  for (const [cat, target] of Object.entries(r.mixTarget)) {
    lines.push(`| ${cat} | ${r.mix[cat] ?? 0} | ${target} |`);
  }
  lines.push('');

  lines.push('## By source', '');
  lines.push(`| Source | Tier | Status | Pages | Successful | Blocked | Failed | Candidates | Accepted | Avg score |`);
  lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const s of r.bySource) {
    lines.push(
      `| ${s.source} | ${s.tier} | ${s.status} | ${s.pagesVisited} | ${s.urlsSuccessful} | ${s.urlsBlocked} | ${s.urlsFailed} | ${s.candidatesFound} | ${s.candidatesAccepted} | ${s.averageScore ?? '—'} |`,
    );
  }
  lines.push('');

  lines.push('## Blocked / unavailable sources', '');
  const blocked = r.bySource.filter((s) => s.status === 'blocked');
  if (blocked.length === 0) lines.push('None — all attempted sources responded.');
  else {
    for (const s of blocked) {
      lines.push(`- **${s.source}** could not be crawled because the source blocked the research client. No circumvention was attempted; the search-index provider was used instead.`);
    }
  }
  lines.push('');

  lines.push('## Top 30 candidates by score', '');
  lines.push(`| Product | Source | Category | Score | Market price |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const c of r.topCandidates.slice(0, 30)) {
    lines.push(`| ${c.name} | ${c.source} | ${c.category} | ${c.score} | ${c.priceEur ? '€' + c.priceEur.toFixed(2) : '—'} |`);
  }
  lines.push('');

  lines.push('## Missing data fields (guide for future supplier requests)', '');
  lines.push(`| Field | Candidates missing |`);
  lines.push(`| --- | --- |`);
  for (const [field, count] of Object.entries(r.missingFieldsReport)) {
    lines.push(`| ${field} | ${count} |`);
  }
  lines.push('');

  lines.push('## Notes', '');
  for (const n of r.notes) lines.push(`- ${n}`);
  if (r.dbNote) lines.push(`- ${r.dbNote}`);
  lines.push('');
  lines.push('---', '');
  lines.push('_This report is an internal research artifact. It is not published to the storefront and contains no secrets._');
  return lines.join('\n');
}

export function missingFieldsReport(candidates: Array<{ candidate: { normalized: { priceEur?: number; dims?: unknown; weightKg?: number; materialsList: string[] }; sourceBrand?: string; sourceImageUrls: string[] } }>): Record<string, number> {
  const counts: Record<string, number> = {
    dimensions: 0,
    material: 0,
    weight: 0,
    brand: 0,
    price: 0,
    images: 0,
  };
  for (const c of candidates) {
    if (!c.candidate.normalized.dims) counts.dimensions++;
    if (c.candidate.normalized.materialsList.length === 0) counts.material++;
    if (c.candidate.normalized.weightKg === undefined) counts.weight++;
    if (!c.candidate.sourceBrand) counts.brand++;
    if (c.candidate.normalized.priceEur === undefined) counts.price++;
    if (c.candidate.sourceImageUrls.length === 0) counts.images++;
  }
  return counts;
}

export { RESEARCH_CONFIG };
