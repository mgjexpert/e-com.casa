import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TOKEN_SHA256 = 'a1d52492732b9b65b0756b036bb6eb0f6c3c906f52ed444d9b3424670777fd97';

function tokenIsValid(token: string | null) {
  if (!token) return false;
  const actual = Buffer.from(createHash('sha256').update(token).digest('hex'));
  const expected = Buffer.from(TOKEN_SHA256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(req: NextRequest) {
  if (!tokenIsValid(req.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const [products, categories, productOffers, productOfferAudits] = await Promise.all([
    db.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    db.category.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
    db.productOffer.findMany({ orderBy: { productSlug: 'asc' } }),
    db.productOfferAudit.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      counts: {
        products: products.length,
        categories: categories.length,
        productOffers: productOffers.length,
        productOfferAudits: productOfferAudits.length,
      },
      products,
      categories,
      productOffers,
      productOfferAudits,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
