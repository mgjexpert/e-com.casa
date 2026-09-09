import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = await db.product.findUnique({ where: { slug } });
    if (!product || product.complianceStatus === 'BLOCKED') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (error) {
    console.error('GET /api/products/[slug] error', error);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}
