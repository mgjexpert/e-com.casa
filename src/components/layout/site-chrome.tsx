'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { OfferCompactFooter } from '@/components/offers/offer-compact-footer';

/**
 * Offers are self-contained campaign destinations. They keep all global
 * infrastructure (cookies, cart, chat, language boot) from RootLayout while
 * owning a minimal campaign header and compact institutional footer.
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
      {isOfferRoute ? <OfferCompactFooter /> : <SiteFooter />}
    </div>
  );
}
