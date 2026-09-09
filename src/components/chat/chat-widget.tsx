'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Mail, ChevronRight, Minus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Topic = {
  label: string;
  reply: string;
  links?: { label: string; href: string }[];
};

const TOPICS: Topic[] = [
  {
    label: 'Order support',
    reply: 'For anything about an order, the fastest route is your order page — have your order number ready (it looks like EC-XXXXXX).',
    links: [
      { label: 'My orders', href: '/account/orders' },
      { label: 'Email orders@e-com.casa', href: 'mailto:orders@e-com.casa' },
    ],
  },
  {
    label: 'Product question',
    reply: 'Every product page lists materials, dimensions and care. Anything else — write us and a human replies within one working day.',
    links: [{ label: 'Email support@e-com.casa', href: 'mailto:support@e-com.casa' }],
  },
  {
    label: 'Delivery',
    reply: 'Free standard shipping across Europe. Standard delivery takes 3–5 working days; express 1–2. Full details on the shipping page.',
    links: [{ label: 'Shipping information', href: '/shipping' }],
  },
  {
    label: 'Returns',
    reply: 'You have 14 days to change your mind on most items. The returns page walks you through all six steps.',
    links: [{ label: 'How to return', href: '/returns' }],
  },
  {
    label: 'Product recommendations',
    reply: 'Happy to help you choose. Tell us the room, the style and the budget — email hello@e-com.casa and we will send a shortlist.',
    links: [{ label: 'Browse best sellers', href: '/shop?sort=best' }],
  },
  {
    label: 'Other',
    reply: 'We are here to help. Email support@e-com.casa and we will get back to you within one working day.',
    links: [{ label: 'Contact page', href: '/contact' }],
  },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Topic | null>(null);

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close chat' : 'Need help? Open chat'}
        className="fixed bottom-5 right-5 z-[60] flex h-13 w-13 items-center justify-center rounded-full bg-ink text-cream shadow-[0_8px_24px_rgba(29,33,30,0.35)] transition-transform hover:scale-105 md:bottom-6 md:right-6"
        style={{ height: 52, width: 52 }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5.5 w-5.5" strokeWidth={1.6} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="E-com.casa Concierge chat"
            className="fixed bottom-[84px] right-5 z-[60] w-[min(92vw,360px)] overflow-hidden rounded-xl border border-border bg-background shadow-[0_20px_60px_rgba(33,30,27,0.22)] md:right-6"
          >
            {/* Header */}
            <div className="bg-ink px-5 py-4">
              <p className="font-display text-[17px] font-medium text-white">E-com.casa Concierge</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#a7ada0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7da87b]" aria-hidden />
                Hello. How can we help?
              </p>
            </div>

            {/* Body */}
            <div className="max-h-[380px] overflow-y-auto thin-scrollbar p-4">
              {!active ? (
                <div className="space-y-2">
                  <p className="mb-3 text-[13px] text-muted-foreground">Choose a topic to get started:</p>
                  {TOPICS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setActive(t)}
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left text-[13.5px] font-medium transition-colors hover:border-ring hover:bg-accent"
                    >
                      {t.label}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="mb-3 flex items-center gap-1 text-[12.5px] font-medium text-olive hover:underline"
                  >
                    <Minus className="h-3.5 w-3.5" /> All topics
                  </button>
                  <div className="rounded-lg rounded-tl-none bg-muted/70 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
                    {active.reply}
                  </div>
                  {active.links && (
                    <div className="mt-3 space-y-1.5">
                      {active.links.map((l) =>
                        l.href.startsWith('mailto:') ? (
                          <a
                            key={l.href}
                            href={l.href}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-olive hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" /> {l.label}
                          </a>
                        ) : (
                          <Link
                            key={l.href}
                            href={l.href}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-olive hover:underline"
                          >
                            <ChevronRight className="h-3.5 w-3.5" /> {l.label}
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/40 px-5 py-3">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                No live agents right now — write us at{' '}
                <a href="mailto:support@e-com.casa" className="underline underline-offset-2 hover:text-foreground">
                  support@e-com.casa
                </a>{' '}
                and we reply within one working day.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
