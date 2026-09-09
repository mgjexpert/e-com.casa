import { Stars } from '@/components/product/product-card';
import { getDemoReviews, getRatingBreakdown } from '@/lib/reviews-data';
import { formatDate } from '@/lib/format';
import { BadgeCheck, Info } from 'lucide-react';

export function ReviewsSection({
  slug,
  rating,
  reviewCount,
}: {
  slug: string;
  rating: number;
  reviewCount: number;
}) {
  const reviews = getDemoReviews(slug);
  const breakdown = getRatingBreakdown(rating, reviewCount);

  return (
    <section aria-labelledby="reviews-heading" className="mt-16 border-t border-border pt-12">
      <h2 id="reviews-heading" className="font-display text-[24px] font-medium">
        Customer reviews
      </h2>

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
          {reviews.map((review, i) => (
            <li key={`${review.author}-${i}`} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-[12.5px] font-semibold text-olive">
                    {review.author.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium leading-tight">
                      {review.author}
                      {review.verifiedBuyer && (
                        <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10.5px] font-semibold uppercase tracking-wide text-olive">
                          <BadgeCheck className="h-3 w-3" strokeWidth={2} />
                          Verified buyer
                        </span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {review.country} · {formatDate(review.date)}
                    </p>
                  </div>
                </div>
                <Stars rating={review.rating} />
              </div>
              <h3 className="mt-3.5 text-[14px] font-semibold">{review.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/80">{review.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
