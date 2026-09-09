'use client';

import { useState } from 'react';
import { Stars } from '@/components/product/product-card';
import { ReviewForm } from '@/components/product/review-form';
import { Button } from '@/components/ui/button';
import { getDemoReviews, getRatingBreakdown, type ReviewDTO } from '@/lib/reviews-data';
import { formatDate } from '@/lib/format';
import { BadgeCheck, Info, PenLine } from 'lucide-react';

/**
 * Interactive part of the reviews section (client).
 * Receives the server-fetched DB reviews as initial props; demo reviews are
 * derived deterministically from the slug — no effects needed.
 */
export function ReviewsPanel({
  slug,
  rating,
  reviewCount,
  reviewMode = 'demo',
  initialDbReviews,
}: {
  slug: string;
  rating: number;
  reviewCount: number;
  reviewMode?: string;
  initialDbReviews: ReviewDTO[];
}) {
  const [dbReviews, setDbReviews] = useState<ReviewDTO[]>(initialDbReviews);
  const [formOpen, setFormOpen] = useState(false);

  const demoReviews: ReviewDTO[] = getDemoReviews(slug).map((r, i) => ({
    id: `demo-${i}`,
    author: r.author,
    country: r.country,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: false,
    createdAt: r.date,
    source: 'demo',
  }));

  // Real submissions first (newest first), demo sample content after.
  const reviews = [...dbReviews, ...demoReviews];
  const breakdown = getRatingBreakdown(rating, reviewCount);
  const customerCount = dbReviews.length;

  const handleSubmitted = (review: ReviewDTO) => {
    setDbReviews((prev) => [review, ...prev]);
  };

  return (
    <>
      {/* Heading + write-review action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="reviews-heading" className="font-display text-[24px] font-medium">
          Customer reviews
        </h2>
        <Button
          onClick={() => setFormOpen(true)}
          className="h-11 gap-2 rounded-md bg-primary px-5 text-[13.5px] font-semibold hover:bg-primary/90"
          aria-haspopup="dialog"
        >
          <PenLine className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Write a review
        </Button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-14">
        {/* Summary */}
        <div className="rounded-lg border border-border bg-cream/50 p-6">
          <div className="flex items-end gap-3">
            <span className="font-display text-[44px] font-medium leading-none">{rating.toFixed(1)}</span>
            <span className="pb-1.5 text-[13px] text-muted-foreground">out of 5</span>
          </div>
          <Stars rating={rating} className="mt-2.5" />
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Based on {reviewCount.toLocaleString('en-GB')} reviews
          </p>
          {reviewMode === 'demo' && (
            <p className="mt-3 flex items-start gap-1.5 rounded-md bg-background/70 px-3 py-2 text-[12px] leading-snug text-muted-foreground" role="note">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              Sample product feedback — demonstration only. This is a preview catalogue.
            </p>
          )}
          {customerCount > 0 && (
            <p className="mt-1 text-[13px] font-medium text-olive">
              Includes {customerCount} recent customer review{customerCount === 1 ? '' : 's'}
            </p>
          )}

          <div className="mt-5 space-y-2">
            {breakdown.map((row) => (
              <div key={row.stars} className="flex items-center gap-2.5">
                <span className="w-7 text-right text-[12px] text-muted-foreground">{row.stars}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" role="presentation">
                  <div className="h-full rounded-full bg-[#e0a03c]" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="w-8 text-[11.5px] tabular-nums text-muted-foreground">{row.pct}%</span>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            Demo store: reviews shown are illustrative sample content, structured for replacement with
            verified customer reviews.
          </p>
        </div>

        {/* Review list */}
        <ul className="space-y-5">
          {reviews.map((review) => {
            const isCustomer = review.source === 'customer';
            return (
              <li
                key={review.id}
                className={
                  isCustomer
                    ? 'rounded-lg rounded-l-sm border border-border border-l-2 border-l-olive bg-card p-5'
                    : 'rounded-lg border border-border bg-card p-5'
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-[12.5px] font-semibold text-olive">
                      {review.author.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-medium leading-tight">
                        {review.author}
                        {review.verified && (
                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10.5px] font-semibold uppercase tracking-wide text-olive">
                            <BadgeCheck className="h-3 w-3" strokeWidth={2} />
                            Verified buyer
                          </span>
                        )}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {review.country && `${review.country} · `}
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Stars rating={review.rating} />
                </div>
                <h3 className="mt-3.5 text-[14px] font-semibold">{review.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/80">{review.body}</p>
                {isCustomer && (
                  <p className="mt-3 border-t border-border/70 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-olive/80">
                    Customer review
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <ReviewForm slug={slug} open={formOpen} onOpenChange={setFormOpen} onSubmitted={handleSubmitted} />
    </>
  );
}
