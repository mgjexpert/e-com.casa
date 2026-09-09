// ============================================================
// E-com.casa — V2 reports (§69–§73, §89)
// ------------------------------------------------------------
// catalog-scrape-v2-report.md   — per-source honesty report
// catalog-product-quality.csv   — every parsed product
// catalog-image-report.csv      — every validated image
// catalog-missing-data.csv      — data gaps per product
// catalog-top-products.csv      — top 30 selection candidates
// REAL extracted vs SYNTHETIC products are always distinguished.
// ============================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { V2_CONFIG } from './config';

export interface SourceReportRow {
  source: string;
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
  imagesValidated: number;
  imagesDownloaded: number;
  averageCompleteness: number;
  errors: number;
  status: string;
}

export interface ProductReportRow {
  source: string;
  productUrl: string;
  productName: string;
  category: string;
  price: string;
  currency: string;
  imageCount: number;
  variantCount: number;
  descriptionPresent: boolean;
  materialPresent: boolean;
  dimensionsPresent: boolean;
  weightPresent: boolean;
  brandPresent: boolean;
  skuPresent: boolean;
  technicalSpecsPresent: boolean;
  complianceDataPresent: boolean;
  completenessScore: number;
  extractionConfidence: number;
  status: string;
  origin: 'REAL_EXTRACTED' | 'SYNTHETIC';
}

export interface ImageReportRow {
  source: string;
  productUrl: string;
  imageUrl: string;
  position: number;
  type: string;
  status: string;
  width: string;
  height: string;
  mime: string;
  downloaded: boolean;
  error: string;
}

export interface MissingDataRow {
  product: string;
  source: string;
  missingField: string;
  severity: string;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(rel: string, header: string[], rows: unknown[][]): void {
  const p = path.join(process.cwd(), rel);
  mkdirSync(path.dirname(p), { recursive: true });
  const lines = [header.join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  writeFileSync(p, lines.join('\n'), 'utf-8');
}

export function writeReports(data: {
  sourceRows: SourceReportRow[];
  productRows: ProductReportRow[];
  imageRows: ImageReportRow[];
  missingRows: MissingDataRow[];
  topRows: Array<Record<string, unknown>>;
  runStats: Record<string, unknown>;
  copiedProducts: Array<{ name: string; category: string; source: string; researchUrl: string; sku: string; price: string }>;
  dataGaps: string[];
  envRequired: string[];
  buildStatus: string;
}): void {
  // ---- CSVs ----
  writeCsv(V2_CONFIG.output.productQualityCsv, ['source', 'productUrl', 'productName', 'category', 'price', 'currency', 'imageCount', 'variantCount', 'descriptionPresent', 'materialPresent', 'dimensionsPresent', 'weightPresent', 'brandPresent', 'skuPresent', 'technicalSpecsPresent', 'complianceDataPresent', 'completenessScore', 'extractionConfidence', 'status', 'origin'], data.productRows.map((r) => [r.source, r.productUrl, r.productName, r.category, r.price, r.currency, r.imageCount, r.variantCount, r.descriptionPresent, r.materialPresent, r.dimensionsPresent, r.weightPresent, r.brandPresent, r.skuPresent, r.technicalSpecsPresent, r.complianceDataPresent, r.completenessScore, r.extractionConfidence, r.status, r.origin]));

  writeCsv(V2_CONFIG.output.imageReportCsv, ['source', 'productUrl', 'imageUrl', 'position', 'type', 'status', 'width', 'height', 'mime', 'downloaded', 'error'], data.imageRows.map((r) => [r.source, r.productUrl, r.imageUrl, r.position, r.type, r.status, r.width, r.height, r.mime, r.downloaded, r.error]));

  writeCsv(V2_CONFIG.output.missingDataCsv, ['product', 'source', 'missingField', 'severity'], data.missingRows.map((r) => [r.product, r.source, r.missingField, r.severity]));

  writeCsv(V2_CONFIG.output.topProductsCsv, ['product', 'source', 'category', 'researchScore', 'completeness', 'imageCount', 'price', 'bundlePotential', 'visualScore', 'commercialScore'], data.topRows.map((r) => [r.product, r.source, r.category, r.researchScore, r.completeness, r.imageCount, r.price, r.bundlePotential, r.visualScore, r.commercialScore]));

  // ---- Markdown report ----
  const s = data.runStats;
  const lines: string[] = [];
  lines.push('# E-COM.CASA — CATALOG SCRAPER V2 REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Run summary');
  lines.push('');
  lines.push(`- Sources attempted: ${s.sourcesAttempted}`);
  lines.push(`- Sources successful: ${s.sourcesSuccessful}`);
  lines.push(`- Sources blocked: ${s.sourcesBlocked}`);
  lines.push(`- Sources failed: ${s.sourcesFailed}`);
  lines.push(`- Pages visited: ${s.pagesVisited}`);
  lines.push(`- Product pages: ${s.productPages}`);
  lines.push(`- Products discovered: ${s.productsDiscovered}`);
  lines.push(`- Products parsed (accepted as real product pages): ${s.productsParsed}`);
  lines.push(`- Duplicates: ${s.duplicates}`);
  lines.push(`- Rejected: ${s.rejected}`);
  lines.push(`- Selected: ${s.selected}`);
  lines.push(`- Imported: ${s.imported}`);
  lines.push('');
  lines.push('## Data quality of imported products');
  lines.push('');
  lines.push(`- Products with real source URLs: ${s.withSourceUrls}`);
  lines.push(`- Products with extracted images: ${s.withImages}`);
  lines.push(`- Products with extracted prices: ${s.withPrices}`);
  lines.push(`- Products with descriptions from research: ${s.withDescriptions}`);
  lines.push(`- Products with variants: ${s.withVariants}`);
  lines.push(`- Products with dimensions: ${s.withDimensions}`);
  lines.push(`- Products with material: ${s.withMaterial}`);
  lines.push(`- Average completeness: ${s.avgCompleteness}`);
  lines.push('');
  lines.push('## Per-source honesty table (§69)');
  lines.push('');
  lines.push('| Source | robots | sitemaps | listing pages | product pages | ok | blocked | failed | discovered | parsed | accepted | rejected | images found | validated | downloaded | avg completeness | status |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of data.sourceRows) {
    lines.push(`| ${r.source} | ${r.robotsStatus} | ${r.sitemapsProcessed} | ${r.listingPages} | ${r.productPages} | ${r.successfulPages} | ${r.blockedPages} | ${r.failedPages} | ${r.productsDiscovered} | ${r.productsParsed} | ${r.productsAccepted} | ${r.productsRejected} | ${r.imagesFound} | ${r.imagesValidated} | ${r.imagesDownloaded} | ${r.averageCompleteness} | ${r.status} |`);
  }
  lines.push('');
  lines.push('## Imported product provenance (REAL research-backed, traceable)');
  lines.push('');
  lines.push('| SKU | Name | Category | Source | Research URL | Demo price |');
  lines.push('|---|---|---|---|---|---|');
  for (const p of data.copiedProducts) {
    lines.push(`| ${p.sku} | ${p.name} | ${p.category} | ${p.source} | ${p.researchUrl} | ${p.price} |`);
  }
  lines.push('');
  lines.push('## Data gaps (§90 — never hidden)');
  lines.push('');
  for (const g of data.dataGaps) lines.push(`- ${g}`);
  lines.push('');
  lines.push('## Environment variables required');
  lines.push('');
  for (const e of data.envRequired) lines.push(`- ${e}`);
  lines.push('');
  lines.push(`## Build status: ${data.buildStatus}`);
  lines.push('');
  lines.push('> This engine is a ONE-SHOT research/import utility. It is not exposed as a public route, cron job or storefront service (§2).');

  const pMd = path.join(process.cwd(), V2_CONFIG.output.reportMd);
  mkdirSync(path.dirname(pMd), { recursive: true });
  writeFileSync(pMd, lines.join('\n'), 'utf-8');

  // JSON twin
  const pJson = path.join(process.cwd(), V2_CONFIG.output.reportJson);
  writeFileSync(pJson, JSON.stringify({ ...data, generatedAt: new Date().toISOString() }, null, 2), 'utf-8');
}
