import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ShopClient } from '@/components/product/shop-client';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Shop — Wall Panels, Lighting, Garden & Outdoor',
  description:
    'Browse the full E-com.casa collection: wood slat wall panels, lighting, garden and outdoor living, decoration and organisation. Free shipping across Europe.',
  alternates: { canonical: '/shop' },
};

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="container-ecom py-10">
          <Skeleton className="h-9 w-48" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        </div>
      }
    >
      <ShopClient />
    </Suspense>
  );
}
