import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { CookieConsent } from '@/components/cookie/cookie-consent';
import { ChatWidget } from '@/components/chat/chat-widget';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { LanguageBoot } from '@/hooks/use-t';
import { COMPANY } from '@/lib/company';

const playfair = Playfair_Display({
  variable: '--font-serif-display',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-sans-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.domain),
  title: {
    default: 'E-com.casa — Make Your Space Yours. | Home & Garden',
    template: '%s | E-com.casa',
  },
  description:
    'Curated pieces for interiors, gardens and everyday living. Wall panels, lighting, garden and outdoor living — designed in Europe, delivered across Europe with free shipping and 14-day returns.',
  keywords: [
    'home and garden',
    'wall panels',
    'lighting',
    'outdoor furniture',
    'interior decoration',
    'European design',
    'E-com.casa',
  ],
  authors: [{ name: COMPANY.legalName }],
  openGraph: {
    title: 'E-com.casa — Make Your Space Yours.',
    description: 'Curated pieces for interiors, gardens and everyday living. Free shipping across Europe.',
    url: COMPANY.domain,
    siteName: 'E-com.casa',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'E-com.casa — Make Your Space Yours.',
    description: 'Curated pieces for interiors, gardens and everyday living.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#1d211e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <a
          href="#main-content"
          className="sr-only z-[100] bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        <CookieConsent />
        <ChatWidget />
        <CartDrawer />
        <LanguageBoot />
        <Toaster />
        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: COMPANY.brand,
              legalName: COMPANY.legalName,
              url: COMPANY.domain,
              email: COMPANY.emails.support,
              address: {
                '@type': 'PostalAddress',
                streetAddress: COMPANY.registeredOffice.line1,
                addressLocality: COMPANY.registeredOffice.city,
                postalCode: COMPANY.registeredOffice.postcode,
                addressCountry: 'GB',
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
