import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SHOPIFY_SUPPLIER_SOURCES, type ShopifySourceId } from '@/lib/suppliers/shopify-public';
import { stageShopifySupplierCatalog } from '@/lib/suppliers/shopify-stage-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-time operational bootstrap. It self-disables quickly and is removed after use.
const EXPIRES_AT = Date.parse('2026-09-11T03:30:00Z');

export async function GET(req: NextRequest) {
  if (Date.now() > EXPIRES_AT) return NextResponse.json({ error: 'Bootstrap expired' }, { status: 410 });

  const sourceId = (new URL(req.url).searchParams.get('source') || 'trendhero') as ShopifySourceId;
  if (!Object.prototype.hasOwnProperty.call(SHOPIFY_SUPPLIER_SOURCES, sourceId)) {
    return NextResponse.json({ error: 'Unknown supplier source' }, { status: 400 });
  }

  const marker = `shopify-public:${sourceId}:`;
  const existing = await db.product.count({ where: { sourceResearchId: { startsWith: marker } } });
  if (existing > 0) {
    return NextResponse.json({ ok: true, source: sourceId, alreadyStaged: existing, skipped: true });
  }

  try {
    const result = await stageShopifySupplierCatalog(sourceId, { limit: 80 });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('One-shot supplier bootstrap failed', sourceId, error);
    return NextResponse.json({ error: 'Supplier bootstrap failed', source: sourceId }, { status: 500 });
  }
}
