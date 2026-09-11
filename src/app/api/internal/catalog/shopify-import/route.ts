import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { SHOPIFY_SUPPLIER_SOURCES, type ShopifySourceId } from '@/lib/suppliers/shopify-public';
import { stageShopifySupplierCatalog } from '@/lib/suppliers/shopify-stage-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = rateLimit(req, 'shopify-stage-import', 4, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many import requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = (searchParams.get('source') || 'trendhero') as ShopifySourceId;
  if (!Object.prototype.hasOwnProperty.call(SHOPIFY_SUPPLIER_SOURCES, sourceId)) {
    return NextResponse.json({ error: 'Unknown supplier source' }, { status: 400 });
  }
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '80', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(80, Math.max(1, requestedLimit)) : 80;

  try {
    const result = await stageShopifySupplierCatalog(sourceId, { limit });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Shopify staging import failed', sourceId, error);
    return NextResponse.json({ error: 'Supplier staging import failed', source: sourceId }, { status: 500 });
  }
}
