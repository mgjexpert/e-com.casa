// ============================================================
// E-com.casa — V2 image pipeline (§11–§14, §38/§39, §78)
// ------------------------------------------------------------
// RESEARCH images: full gallery discovery from real product
// pages, validated (HTTP/content-type/size) and downloaded into
// the gitignored research-assets/ directory — internal only,
// never published.
// PUBLIC images: the storefront never hotlinks third-party
// imagery. Final demo products reference E-com.casa's own
// generated image pool (imageStatus = GENERATED).
// ============================================================

import { createHash } from 'node:crypto';
import path from 'node:path';
import { V2_CONFIG } from './config';
import { checkImage, downloadImage } from './http';
import type { ImageRecord } from './extract';

export interface ValidatedImage {
  record: ImageRecord;
  status: 'VALIDATED' | 'FAILED' | 'REJECTED';
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  sha256?: string;
  localPath?: string;
  error?: string;
}

const imageValidationLog: ValidatedImage[] = [];

export function getImageValidationLog(): ValidatedImage[] {
  return imageValidationLog;
}

/** Validate the gallery of one product (bounded, §12). */
export async function validateGallery(sourceKey: string, gallery: ImageRecord[]): Promise<ValidatedImage[]> {
  const out: ValidatedImage[] = [];
  for (const record of gallery.slice(0, V2_CONFIG.images.validatePerProduct)) {
    const res = await checkImage(record.sourceUrl);
    const v: ValidatedImage = { record, status: res.ok ? 'VALIDATED' : 'FAILED', mimeType: res.contentType, fileSize: res.contentLength, error: res.error };
    out.push(v);
    imageValidationLog.push(v);
  }
  for (const record of gallery.slice(V2_CONFIG.images.validatePerProduct)) {
    const v: ValidatedImage = { record, status: 'REJECTED', error: 'Beyond validation cap' };
    out.push(v);
    imageValidationLog.push(v);
  }
  return out;
}

/** Download the best validated images for one selected product (§13, research-only). */
export async function downloadResearchImages(
  sourceKey: string,
  productSlug: string,
  validated: ValidatedImage[],
): Promise<ValidatedImage[]> {
  const out: ValidatedImage[] = [];
  const baseDir = path.join(process.cwd(), V2_CONFIG.output.assetsDir, sourceKey, productSlug);
  let index = 0;
  for (const v of validated) {
    if (v.status !== 'VALIDATED') {
      out.push(v);
      continue;
    }
    if (index >= V2_CONFIG.images.downloadPerProduct) {
      out.push(v);
      continue;
    }
    const ext = (v.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
    const dest = path.join(baseDir, `img-${index}.${ext}`);
    const res = await downloadImage(v.record.sourceUrl, dest);
    if (res.ok) {
      index++;
      out.push({
        ...v,
        status: 'DOWNLOADED',
        fileSize: res.bytes ?? v.fileSize,
        sha256: createHash('sha256').update(`${v.record.sourceUrl}`).digest('hex'),
        localPath: path.relative(process.cwd(), dest),
      });
    } else {
      out.push({ ...v, status: 'FAILED', error: res.error ?? 'download failed' });
    }
  }
  return out;
}

// ---------------- Public image pool (E-com.casa's own generated assets) ----------------

interface PoolEntry {
  image: string;
  hover?: string;
  gallery: string[];
}

const IMG = (name: string): string => `/images/${name}.jpg`;

const PUBLIC_POOL: Record<string, PoolEntry[]> = {
  lighting: [
    { image: IMG('product-led-table-lamp'), hover: IMG('gallery-led-table-lamp-lifestyle'), gallery: [IMG('gallery-led-table-lamp-lifestyle'), IMG('gallery-led-table-lamp-detail'), IMG('gallery-string-lights-detail')] },
    { image: IMG('product-pendant-lamp'), hover: IMG('gallery-pendant-lamp-lifestyle'), gallery: [IMG('gallery-pendant-lamp-lifestyle'), IMG('gallery-pendant-lamp-detail'), IMG('gallery-led-table-lamp-detail')] },
    { image: IMG('product-floor-lamp'), hover: IMG('gallery-led-table-lamp-lifestyle'), gallery: [IMG('gallery-led-table-lamp-lifestyle'), IMG('gallery-led-table-lamp-detail')] },
    { image: IMG('product-outdoor-wall-light'), hover: IMG('gallery-string-lights-lifestyle'), gallery: [IMG('gallery-string-lights-lifestyle'), IMG('gallery-string-lights-detail')] },
    { image: IMG('product-string-lights'), hover: IMG('gallery-string-lights-lifestyle'), gallery: [IMG('gallery-string-lights-lifestyle'), IMG('gallery-string-lights-detail'), IMG('gallery-garden-torch-lifestyle')] },
    { image: IMG('product-smart-lamp'), hover: IMG('gallery-led-table-lamp-lifestyle'), gallery: [IMG('gallery-led-table-lamp-lifestyle'), IMG('gallery-led-table-lamp-detail')] },
  ],
  'wall-panels': [
    { image: IMG('product-wood-slat-panel'), hover: IMG('gallery-wood-slat-panel-lifestyle'), gallery: [IMG('gallery-wood-slat-panel-lifestyle'), IMG('gallery-wood-slat-panel-detail')] },
  ],
  decoration: [
    { image: IMG('product-arched-mirror'), hover: IMG('gallery-arched-mirror-lifestyle'), gallery: [IMG('gallery-arched-mirror-lifestyle'), IMG('gallery-arched-mirror-detail')] },
    { image: IMG('product-ceramic-vase-set'), hover: IMG('gallery-ceramic-vase-set-lifestyle'), gallery: [IMG('gallery-ceramic-vase-set-lifestyle'), IMG('gallery-ceramic-vase-set-detail')] },
    { image: IMG('product-wall-art'), hover: IMG('gallery-arched-mirror-lifestyle'), gallery: [IMG('gallery-arched-mirror-detail')] },
    { image: IMG('product-wall-clock'), hover: IMG('gallery-wall-clock-lifestyle'), gallery: [IMG('gallery-wall-clock-lifestyle'), IMG('gallery-wall-clock-detail')] },
    { image: IMG('product-decorative-tray'), hover: IMG('gallery-ceramic-vase-set-lifestyle'), gallery: [IMG('gallery-ceramic-vase-set-detail')] },
  ],
  garden: [
    { image: IMG('product-solar-lantern'), hover: IMG('gallery-solar-lantern-lifestyle'), gallery: [IMG('gallery-solar-lantern-lifestyle'), IMG('gallery-solar-lantern-detail'), IMG('gallery-garden-torch-detail')] },
    { image: IMG('product-garden-torch'), hover: IMG('gallery-garden-torch-lifestyle'), gallery: [IMG('gallery-garden-torch-lifestyle'), IMG('gallery-garden-torch-detail')] },
    { image: IMG('product-fire-pit'), hover: IMG('gallery-fire-pit-lifestyle'), gallery: [IMG('gallery-fire-pit-lifestyle'), IMG('gallery-fire-pit-detail')] },
  ],
  outdoor: [
    { image: IMG('product-outdoor-sofa'), hover: IMG('gallery-outdoor-sofa-lifestyle'), gallery: [IMG('gallery-outdoor-sofa-lifestyle'), IMG('gallery-outdoor-sofa-detail')] },
    { image: IMG('product-rattan-chair'), hover: IMG('gallery-rattan-chair-lifestyle'), gallery: [IMG('gallery-rattan-chair-lifestyle'), IMG('gallery-rattan-chair-detail')] },
    { image: IMG('product-parasol'), hover: IMG('gallery-outdoor-sofa-lifestyle'), gallery: [IMG('gallery-outdoor-sofa-detail')] },
    { image: IMG('product-teak-bench'), hover: IMG('gallery-teak-bench-lifestyle'), gallery: [IMG('gallery-teak-bench-lifestyle'), IMG('gallery-teak-bench-detail')] },
    { image: IMG('product-bistro-set'), hover: IMG('gallery-rattan-chair-lifestyle'), gallery: [IMG('gallery-rattan-chair-detail'), IMG('gallery-outdoor-sofa-detail')] },
  ],
  planters: [
    { image: IMG('product-ceramic-planter'), hover: IMG('gallery-ceramic-planter-lifestyle'), gallery: [IMG('gallery-ceramic-planter-lifestyle'), IMG('gallery-ceramic-planter-detail')] },
    { image: IMG('product-palm-planter'), hover: IMG('gallery-palm-planter-lifestyle'), gallery: [IMG('gallery-palm-planter-lifestyle'), IMG('gallery-palm-planter-detail')] },
    { image: IMG('product-raised-planter'), hover: IMG('gallery-palm-planter-lifestyle'), gallery: [IMG('gallery-palm-planter-detail')] },
    { image: IMG('product-herb-pots'), hover: IMG('gallery-ceramic-planter-lifestyle'), gallery: [IMG('gallery-ceramic-planter-detail')] },
  ],
  'outdoor-privacy': [
    { image: IMG('product-privacy-screen'), hover: IMG('gallery-teak-bench-lifestyle'), gallery: [IMG('gallery-teak-bench-detail'), IMG('gallery-palm-planter-detail')] },
  ],
  organisation: [
    { image: IMG('product-seagrass-basket'), hover: IMG('gallery-seagrass-basket-lifestyle'), gallery: [IMG('gallery-seagrass-basket-lifestyle'), IMG('gallery-seagrass-basket-detail')] },
    { image: IMG('product-storage-jars'), hover: IMG('gallery-seagrass-basket-lifestyle'), gallery: [IMG('gallery-seagrass-basket-detail')] },
    { image: IMG('product-oak-wall-shelf'), hover: IMG('gallery-oak-wall-shelf-lifestyle'), gallery: [IMG('gallery-oak-wall-shelf-lifestyle'), IMG('gallery-oak-wall-shelf-detail')] },
  ],
  'kitchen-dining': [
    { image: IMG('product-serving-board'), hover: IMG('gallery-oak-wall-shelf-lifestyle'), gallery: [IMG('gallery-oak-wall-shelf-detail')] },
    { image: IMG('product-dining-bowls'), hover: IMG('gallery-oak-wall-shelf-lifestyle'), gallery: [IMG('gallery-oak-wall-shelf-detail'), IMG('gallery-seagrass-basket-detail')] },
  ],
  'gadgets-smart-home': [
    { image: IMG('product-led-light-strip'), hover: IMG('gallery-string-lights-lifestyle'), gallery: [IMG('gallery-string-lights-lifestyle'), IMG('gallery-string-lights-detail')] },
    { image: IMG('product-smart-lamp'), hover: IMG('gallery-led-table-lamp-lifestyle'), gallery: [IMG('gallery-led-table-lamp-detail')] },
  ],
  accessories: [
    { image: IMG('product-linen-cushions'), hover: IMG('gallery-linen-cushions-lifestyle'), gallery: [IMG('gallery-linen-cushions-lifestyle'), IMG('gallery-linen-cushions-detail')] },
    { image: IMG('product-doormat'), hover: IMG('gallery-linen-cushions-lifestyle'), gallery: [IMG('gallery-linen-cushions-detail')] },
    { image: IMG('product-candle-set'), hover: IMG('gallery-linen-cushions-lifestyle'), gallery: [IMG('gallery-linen-cushions-detail'), IMG('gallery-ceramic-vase-set-detail')] },
  ],
};

/** Deterministic assignment from E-com.casa's own generated pool (never third-party, §78). */
export function assignPublicImages(category: string, indexInCategory: number, styleSeed: string): PoolEntry {
  const pool = PUBLIC_POOL[category] ?? PUBLIC_POOL.decoration;
  const offset = Math.abs(hashStr(styleSeed)) % pool.length;
  return pool[(indexInCategory + offset) % pool.length];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Shipping class demo inference (§68). */
export function inferShippingClass(category: string, dimsText: string | null, material: string | null, isElectrical: boolean): 'SMALL' | 'STANDARD' | 'FRAGILE' | 'OVERSIZED' | 'HEAVY' | 'SPECIAL' {
  const m = (material ?? '').toLowerCase();
  const cat = category;
  const big = /panel|cladding|screen|sofa|bench|table|lounger|parasol|wardrobe/i.test(`${cat} ${dimsText ?? ''}`);
  const hasBigDims = /\d{3,}/.test(dimsText ?? '') && !/mm\b/.test(dimsText ?? '');
  if (/mirror/i.test(`${cat} ${m}`)) return 'FRAGILE';
  if (cat === 'wall-panels' || (big && hasBigDims)) return 'OVERSIZED';
  if (m.includes('ceramic') || m.includes('porcelain') || m.includes('stoneware') || m.includes('glass') || m.includes('marble')) return 'FRAGILE';
  if (/fire ?pit|concrete|stone/.test(`${cat} ${m}`)) return 'HEAVY';
  if (isElectrical) return 'STANDARD';
  return 'STANDARD';
}
