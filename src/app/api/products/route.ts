import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const space = searchParams.get('space');
    const style = searchParams.get('style');
    const collection = searchParams.get('collection');
    const q = searchParams.get('q');
    const sort = searchParams.get('sort') ?? 'featured';
    const minPrice = parseFloat(searchParams.get('minPrice') ?? '');
    const maxPrice = parseFloat(searchParams.get('maxPrice') ?? '');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const perPage = Math.min(48, parseInt(searchParams.get('perPage') ?? '24', 10) || 24);

    const where: Record<string, unknown> = { complianceStatus: { not: 'BLOCKED' } };

    if (category) where.categorySlug = category;
    if (space) where.spaceSlugs = { contains: space };
    if (style) where.styleSlugs = { contains: style };
    if (collection) where.collectionSlugs = { contains: collection };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { subtitle: { contains: q } },
        { categorySlug: { contains: q } },
      ];
    }
    if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
      const priceFilter: Record<string, number> = {};
      if (!Number.isNaN(minPrice)) priceFilter.gte = minPrice;
      if (!Number.isNaN(maxPrice)) priceFilter.lte = maxPrice;
      where.price = priceFilter;
    }

    const orderBy: Record<string, 'asc' | 'desc'> =
      sort === 'price-asc'
        ? { price: 'asc' }
        : sort === 'price-desc'
          ? { price: 'desc' }
          : sort === 'rating'
            ? { rating: 'desc' }
            : sort === 'best'
              ? { reviewCount: 'desc' }
              : sort === 'new'
                ? { createdAt: 'desc' }
                : { sortOrder: 'asc' };

    const [products, total] = await Promise.all([
      db.product.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    console.error('GET /api/products error', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
