import { db } from '@/lib/db';
import { Hero } from '@/components/home/hero';
import { ShopBySpace } from '@/components/home/shop-by-space';
import { ShopByStyle } from '@/components/home/shop-by-style';
import { Collections } from '@/components/home/collections';
import { BestSellers } from '@/components/home/best-sellers';
import { JournalBanner } from '@/components/home/journal-banner';
import type { Category, Product } from '@/types';

export const dynamic = 'force-dynamic';

async function getHomeData() {
  try {
    const [spaces, styles, bestSellers] = await Promise.all([
      db.category.findMany({
        where: { type: 'space' },
        orderBy: { sortOrder: 'asc' },
      }),
      db.category.findMany({
        where: { type: 'style' },
        orderBy: { sortOrder: 'asc' },
      }),
      db.product.findMany({
        where: { isBestSeller: true, complianceStatus: { not: 'BLOCKED' } },
        orderBy: { reviewCount: 'desc' },
        take: 6,
      }),
    ]);
    return {
      spaces: spaces as unknown as Category[],
      styles: styles as unknown as Category[],
      bestSellers: bestSellers as unknown as Product[],
    };
  } catch {
    return { spaces: [], styles: [], bestSellers: [] };
  }
}

export default async function HomePage() {
  const { spaces, styles, bestSellers } = await getHomeData();

  return (
    <>
      <Hero />
      <ShopBySpace spaces={spaces} />
      <ShopByStyle styles={styles} />
      <Collections />
      <BestSellers products={bestSellers} />
      <JournalBanner />
    </>
  );
}
