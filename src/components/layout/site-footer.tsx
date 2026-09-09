'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Instagram, Facebook, Youtube, MapPin, Mail } from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { useCookieConsent } from '@/lib/cookie-store';
import { toast } from '@/hooks/use-toast';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Living Room', href: '/shop?space=living-room' },
      { label: 'Bedroom', href: '/shop?space=bedroom' },
      { label: 'Kitchen', href: '/shop?space=kitchen' },
      { label: 'Bathroom', href: '/shop?space=bathroom' },
      { label: 'Garden', href: '/shop?space=garden' },
      { label: 'Outdoor', href: '/shop?category=outdoor' },
      { label: 'Lighting', href: '/shop?category=lighting' },
      { label: 'Wall Panels', href: '/shop?category=wall-panels' },
      { label: 'Decoration', href: '/shop?category=decoration' },
      { label: 'Organisation', href: '/shop?category=organisation' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/contact#faq' },
      { label: 'Shipping & Delivery', href: '/shipping' },
      { label: 'Returns & Refunds', href: '/returns' },
      { label: 'Track My Order', href: '/account/orders' },
      { label: 'Warranty', href: '/legal/warranty' },
      { label: 'Product Safety', href: '/legal/product-safety' },
      { label: 'Accessibility', href: '/legal/accessibility' },
      { label: 'Live Chat', href: '/contact#chat' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'About E-com.casa', href: '/about' },
      { label: 'Our Story', href: '/about#story' },
      { label: 'Journal', href: '/journal' },
      { label: 'Inspiration', href: '/inspiration' },
      { label: 'Sustainability', href: '/sustainability' },
      { label: 'Careers', href: '/about#careers' },
      { label: 'Press', href: '/about#press' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Legal Notice', href: '/legal/notice' },
      { label: 'Terms & Conditions', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
      { label: 'Cookie Settings', href: '/legal/cookie-settings' },
      { label: 'Returns & Withdrawal', href: '/legal/returns' },
      { label: 'Shipping Policy', href: '/legal/shipping' },
      { label: 'Product Safety', href: '/legal/product-safety' },
      { label: 'Complaints', href: '/legal/complaints' },
      { label: 'Dispute Resolution', href: '/legal/dispute-resolution' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'My Orders', href: '/account/orders' },
      { label: 'Wishlist', href: '/wishlist' },
      { label: 'Saved Addresses', href: '/account#addresses' },
    ],
  },
];

export function SiteFooter() {
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const reopenCookies = useCookieConsent((s) => s.reopen);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    setSubscribing(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      });
      if (res.ok) {
        toast({ title: 'Welcome to the journal', description: 'You are on the list. Inspiration is on its way.' });
        setEmail('');
      } else {
        const data = await res.json().catch(() => null);
        toast({ title: data?.error ?? 'Something went wrong. Please try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="mt-auto bg-ink text-[#c9cdc4]" aria-label="Site footer">
      {/* Newsletter band */}
      <div className="border-b border-white/10">
        <div className="container-ecom flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
          <div className="max-w-md">
            <h2 className="font-display text-2xl font-medium text-white">Join our newsletter</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a7ada0]">
              Get exclusive offers, product launches and home inspiration. Unsubscribe at any time.
            </p>
          </div>
          <form onSubmit={subscribe} className="flex w-full max-w-md gap-2" aria-label="Newsletter signup">
            <label htmlFor="newsletter-email" className="sr-only">
              Your email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="h-12 flex-1 rounded-md border border-white/15 bg-white/5 px-4 text-sm text-white outline-none transition-colors placeholder:text-[#8a9082] focus:border-[#e0a03c]/60 focus:ring-2 focus:ring-[#e0a03c]/20"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#e0a03c] text-ink transition-all hover:bg-[#eab157] disabled:opacity-60"
              aria-label="Subscribe to newsletter"
            >
              <ArrowRight className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>

      {/* Link columns */}
      <div className="container-ecom grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={`${col.title} links`}>
            <h3 className="eyebrow mb-4 text-[#e0a03c]">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] leading-snug text-[#b3b8ad] transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {col.title === 'Legal' && (
                <li>
                  <button
                    type="button"
                    onClick={reopenCookies}
                    className="text-[13px] text-[#b3b8ad] transition-colors hover:text-white"
                  >
                    Cookie Settings
                  </button>
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>

      {/* Company legal identity */}
      <div className="border-t border-white/10">
        <div className="container-ecom grid gap-8 py-10 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-cream">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M3.5 10.5 12 3.5l8.5 7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 20v-5.5h4V20" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-display text-lg font-semibold text-white">E-com.casa</span>
            </div>
            <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-[#9aa093]">
              E-com.casa is a trading brand operated by {COMPANY.legalName}, registered in{' '}
              {COMPANY.countryOfIncorporation}. Company No. {COMPANY.companyNumber}.
            </p>
            <address className="mt-3 text-[12.5px] not-italic leading-relaxed text-[#9aa093]">
              {COMPANY.registeredOffice.line1}, {COMPANY.registeredOffice.line2}, {COMPANY.registeredOffice.city},{' '}
              {COMPANY.registeredOffice.postcode}, {COMPANY.registeredOffice.country}
            </address>
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-[#9aa093]">
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
              <a href={`mailto:${COMPANY.emails.support}`} className="transition-colors hover:text-white">
                {COMPANY.emails.support}
              </a>
            </p>
            <p className="mt-1.5 text-[12.5px] text-[#9aa093]">Telephone: {COMPANY.telephone}</p>
          </div>
          <div className="flex flex-col items-start justify-between gap-8 md:items-end">
            <div className="flex items-center gap-3">
              {/* Social icons — shown as placeholders pending real profiles */}
              {[
                { label: 'Instagram (coming soon)', icon: Instagram },
                { label: 'Pinterest (coming soon)', icon: null },
                { label: 'TikTok (coming soon)', icon: Youtube },
                { label: 'Facebook (coming soon)', icon: Facebook },
              ].map((s) => (
                <span
                  key={s.label}
                  role="img"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-9 w-9 cursor-default items-center justify-center rounded-full border border-white/12 text-[#9aa093]"
                >
                  {s.icon ? <s.icon className="h-4 w-4" strokeWidth={1.5} /> : <span className="text-[11px] font-semibold">P</span>}
                </span>
              ))}
            </div>
            <div className="text-left md:text-right">
              <p className="text-[12px] text-[#8a9082]">
                © 2026 {COMPANY.brand}. All rights reserved.
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[#8a9082] md:justify-end">
                <MapPin className="h-3 w-3" strokeWidth={1.5} />
                Prices include VAT. Free shipping across Europe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
