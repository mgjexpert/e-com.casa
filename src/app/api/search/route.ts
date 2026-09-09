import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();

    if (!q || q === 'all') {
      const products = await db.product.findMany({
        where: { complianceStatus: { not: 'BLOCKED' }, featured: true },
        take: 12,
      });
      return NextResponse.json({ products, query: q });
    }

    const products = await db.product.findMany({
      where: {
        complianceStatus: { not: 'BLOCKED' },
        OR: [
          { name: { contains: q } },
          { subtitle: { contains: q } },
          { description: { contains: q } },
          { categorySlug: { contains: q } },
          { spaceSlugs: { contains: q } },
          { styleSlugs: { contains: q } },
          { color: { contains: q } },
        ],
      },
      take: 24,
    });

    return NextResponse.json({ products, query: q });
  } catch (error) {
    console.error('GET /api/search error', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
