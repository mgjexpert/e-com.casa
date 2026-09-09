import { ReviewsPanel } from '@/components/product/reviews-panel';
import type { ReviewDTO } from '@/lib/reviews-data';

/**
 * Server shell for the reviews section. The DB reviews are fetched
 * server-side (product page) and passed down; all interactivity
 * (merge list, write-review dialog) lives in the client ReviewsPanel.
 */
export function ReviewsSection({
  slug,
  rating,
  reviewCount,
  dbReviews = [],
}: {
  slug: string;
  rating: number;
  reviewCount: number;
  dbReviews?: ReviewDTO[];
}) {
  return (
    <section aria-labelledby="reviews-heading" className="mt-16 border-t border-border pt-12">
      <ReviewsPanel slug={slug} rating={rating} reviewCount={reviewCount} initialDbReviews={dbReviews} />
    </section>
  );
}
