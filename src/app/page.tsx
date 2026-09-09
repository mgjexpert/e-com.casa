import { getBestSellers, getCategories } from '@/lib/catalog';
import { Hero } from '@/components/home/hero';
import { ShopBySpace } from '@/components/home/shop-by-space';
import { ShopByStyle } from '@/components/home/shop-by-style';
import { Collections } from '@/components/home/collections';
import { BestSellers } from '@/components/home/best-sellers';
import { JournalBanner } from '@/components/home/journal-banner';

export const dynamic = 'force-dynamic';

async function getHomeData() {
  try {
    const [spaces, styles, bestSellers] = await Promise.all([
      getCategories('space'),
      getCategories('style'),
      getBestSellers(6),
    ]);
    return { spaces, styles, bestSellers };
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
