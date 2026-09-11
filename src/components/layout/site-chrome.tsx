'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

/**
 * Offers are campaign destinations: they keep institutional/legal footer and
 * all global infrastructure, while removing the full navigation header to
 * reduce distraction. The offer renders its own minimal E-com.casa market
 * header inside the page.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOfferRoute = pathname.startsWith('/offers/');

  return (
    <div className="flex min-h-screen flex-col">
      {!isOfferRoute && <SiteHeader />}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
