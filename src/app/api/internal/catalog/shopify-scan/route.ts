import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  SHOPIFY_SUPPLIER_SOURCES,
  scanShopifySupplier,
  type ShopifySourceId,
} from '@/lib/suppliers/shopify-public';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Read-only supplier research endpoint.
 * It accepts only the hard-coded supplier IDs above, so it cannot be
 * used as a generic proxy/SSRF endpoint and performs no database writes.
 */
export async function GET(req: NextRequest) {
  const limitResult = rateLimit(req, 'shopify-supplier-scan', 5, 60_000);
  if (!limitResult.ok) {
    return NextResponse.json(
      { error: 'Too many supplier scan requests' },
      { status: 429, headers: { 'Retry-After': String(limitResult.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const sourceId = (searchParams.get('source') || 'trendhero') as ShopifySourceId;
  if (!Object.prototype.hasOwnProperty.call(SHOPIFY_SUPPLIER_SOURCES, sourceId)) {
    return NextResponse.json(
      { error: 'Unknown source', allowedSources: Object.keys(SHOPIFY_SUPPLIER_SOURCES) },
      { status: 400 },
    );
  }

  const requestedLimit = Number.parseInt(searchParams.get('limit') || '12', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 12;

  try {
    const result = await scanShopifySupplier(sourceId, {
      limit,
      maxCollectionPages: 2,
      delayMs: 300,
    });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Shopify supplier scan failed', sourceId, error);
    return NextResponse.json({ error: 'Supplier scan failed', source: sourceId }, { status: 502 });
  }
}
