#!/usr/bin/env bun
// ============================================================
// E-com.casa — BigBuy research-media enrichment
// ------------------------------------------------------------
// Populates ResearchProduct.sourceImageUrls using BigBuy's official
// authenticated catalogue image feed so the storefront research bridge
// can render real supplier photography instead of placeholders.
//
// This does NOT scrape retailer images. It only accepts cdnbigbuy.com URLs
// returned by the official BigBuy API.
//
// Required to persist media:
//   BIGBUY_API_KEY=...
//   BIGBUY_ASSET_RIGHTS_CONFIRMED=1
//
// Optional:
//   BIGBUY_API_BASE_URL=https://api.bigbuy.eu
//   BIGBUY_ISO_CODE=pt
//   BIGBUY_MEDIA_LIMIT=1000
// ============================================================

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const API_BASE = (process.env.BIGBUY_API_BASE_URL || 'https://api.bigbuy.eu').replace(/\/+$/, '');
const API_KEY = process.env.BIGBUY_API_KEY?.trim() || '';
const ISO = (process.env.BIGBUY_ISO_CODE || 'pt').trim().toLowerCase();
const RIGHTS_CONFIRMED = /^(1|true|yes)$/i.test(process.env.BIGBUY_ASSET_RIGHTS_CONFIRMED || '');
const LIMIT = Math.max(1, Math.min(5000, Number.parseInt(process.env.BIGBUY_MEDIA_LIMIT || '1000', 10) || 1000));

interface Taxonomy {
  id: number;
  name?: string;
}

interface BigBuyImage {
  id?: number;
  isCover?: boolean | string;
  name?: string;
  url?: string;
  logo?: boolean;
  whiteBackground?: boolean;
}

interface BigBuyImageSet {
  id: number;
  images?: BigBuyImage[];
}

async function api<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BIGBUY_API_KEY is missing');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'User-Agent': 'E-com.casa/1.0 supplier-media-sync',
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BigBuy ${response.status} ${path}: ${text.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

function cleanImages(images: BigBuyImage[] | undefined): string[] {
  if (!images) return [];
  return images
    .filter((image) => image.url && !image.logo)
    .sort((a, b) => Number(isCover(b)) - Number(isCover(a)))
    .map((image) => String(image.url || '').trim())
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'cdnbigbuy.com' && parsed.pathname.startsWith('/images/');
      } catch {
        return false;
      }
    })
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 12);
}

function isCover(image: BigBuyImage): boolean {
  return image.isCover === true || String(image.isCover || '').toUpperCase() === 'TRUE';
}

async function main() {
  if (!API_KEY) throw new Error('BIGBUY_API_KEY is required');
  if (!RIGHTS_CONFIRMED) {
    throw new Error('Refusing to persist supplier photography: set BIGBUY_ASSET_RIGHTS_CONFIRMED=1 only when your BigBuy distributor agreement authorises commercial use of the supplied media.');
  }

  const source = await db.researchSource.findUnique({ where: { key: 'bigbuy-public-index' } });
  if (!source) throw new Error('Research source bigbuy-public-index not found');

  const rows = await db.researchProduct.findMany({
    where: {
      sourceId: source.id,
      sourceProductId: { not: null },
      status: { in: ['NORMALIZED', 'SELECTED', 'IMPORTED'] },
    },
    select: { id: true, sourceProductId: true, sourceProductName: true },
    take: LIMIT,
  });

  const wanted = new Map(rows.map((row) => [Number(row.sourceProductId), row]).filter(([id]) => Number.isInteger(id) && Number(id) > 0));
  if (wanted.size === 0) {
    console.log('[bigbuy-media] no research products to enrich');
    return;
  }

  const roots = await api<Taxonomy[]>(`/rest/catalog/taxonomies.json?firstLevel&isoCode=${encodeURIComponent(ISO)}`);
  const homeRoots = roots.filter((taxonomy) => /(home|house|kitchen|garden|lighting|decoration|casa|cozinha|jardim|ilumina|hogar|cocina|jard[ií]n|maison|cuisine|garten|k[uü]che)/i.test(taxonomy.name || ''));

  let enriched = 0;
  let missing = new Set(wanted.keys());

  for (const root of homeRoots) {
    if (missing.size === 0) break;
    let imageSets: BigBuyImageSet[] = [];
    try {
      imageSets = await api<BigBuyImageSet[]>(`/rest/catalog/productsimages.json?parentTaxonomy=${encodeURIComponent(String(root.id))}`);
    } catch (error) {
      console.warn(`[bigbuy-media] taxonomy ${root.id} failed`, error);
      continue;
    }

    for (const imageSet of imageSets) {
      if (!missing.has(imageSet.id)) continue;
      const row = wanted.get(imageSet.id);
      if (!row) continue;
      const urls = cleanImages(imageSet.images);
      if (urls.length === 0) continue;

      await db.researchProduct.update({
        where: { id: row.id },
        data: {
          sourceImageUrls: JSON.stringify(urls),
          imageCount: urls.length,
          observedAt: new Date(),
        },
      });

      await db.researchImage.deleteMany({ where: { researchProductId: row.id, sourceKey: 'bigbuy-api' } });
      await db.researchImage.createMany({
        data: urls.map((url, index) => ({
          researchProductId: row.id,
          sourceKey: 'bigbuy-api',
          sourceUrl: url,
          normalizedUrl: url,
          position: index,
          type: index === 0 ? 'primary' : 'gallery',
          status: 'VALIDATED',
        })),
      });

      enriched += 1;
      missing.delete(imageSet.id);
      console.log(`[bigbuy-media] ${imageSet.id} ${row.sourceProductName}: ${urls.length} image(s)`);
    }
  }

  console.log(JSON.stringify({ requested: wanted.size, enriched, missing: [...missing] }, null, 2));
  if (enriched === 0) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error('[bigbuy-media] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
