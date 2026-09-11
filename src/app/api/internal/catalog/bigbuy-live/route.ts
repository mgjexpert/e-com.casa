import { NextRequest, NextResponse } from 'next/server';
import { refreshBigBuyLiveCatalogue } from '@/lib/suppliers/bigbuy-live';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await refreshBigBuyLiveCatalogue();
    return NextResponse.json({ ok: result.configured, ...result, at: new Date().toISOString() }, { status: result.configured ? 200 : 503 });
  } catch (error) {
    console.error('BigBuy live catalogue refresh failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Supplier refresh failed' }, { status: 500 });
  }
}
