#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  SHOPIFY_SUPPLIER_SOURCES,
  scanShopifySupplier,
  type ShopifySourceId,
} from '../../src/lib/suppliers/shopify-public';

const requested = (process.argv[2] || process.env.SHOPIFY_SOURCE || 'trendhero').toLowerCase();
const ids = requested === 'all'
  ? Object.keys(SHOPIFY_SUPPLIER_SOURCES) as ShopifySourceId[]
  : [requested as ShopifySourceId];

const maxProducts = Math.min(80, Math.max(1, Number.parseInt(process.env.SHOPIFY_SCAN_LIMIT || '40', 10) || 40));
const maxPages = Math.min(8, Math.max(1, Number.parseInt(process.env.SHOPIFY_SCAN_PAGES || '4', 10) || 4));
const delayMs = Math.min(2_000, Math.max(250, Number.parseInt(process.env.SHOPIFY_SCAN_DELAY_MS || '450', 10) || 450));

for (const id of ids) {
  if (!Object.prototype.hasOwnProperty.call(SHOPIFY_SUPPLIER_SOURCES, id)) {
    console.error(`Unknown Shopify source: ${id}`);
    console.error(`Allowed: ${Object.keys(SHOPIFY_SUPPLIER_SOURCES).join(', ')}, all`);
    process.exitCode = 1;
    continue;
  }

  console.log(`Scanning ${SHOPIFY_SUPPLIER_SOURCES[id].name} (${id})...`);
  const result = await scanShopifySupplier(id, {
    limit: maxProducts,
    maxCollectionPages: maxPages,
    delayMs,
  });

  const outDir = path.join(process.cwd(), 'data', 'catalog', 'shopify-research');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${id}.json`);
  writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');

  console.log(JSON.stringify({
    source: id,
    collectionPagesVisited: result.collectionPagesVisited,
    productLinksDiscovered: result.productLinksDiscovered,
    productsFetched: result.productsFetched,
    blockedByRobots: result.blockedByRobots,
    warnings: result.warnings.length,
    output: path.relative(process.cwd(), outFile),
  }, null, 2));
}
