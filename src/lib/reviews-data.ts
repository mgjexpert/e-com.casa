// ============================================================
// Demo review dataset — V1 MOCK (spec #63: "Reviews: demo content
// clearly structured for later replacement").
// Reviews are deterministically assigned per product so the page
// is stable between renders. Replace with a Review model + API
// when real customer reviews exist. Do NOT present as verified.
// ============================================================

export interface DemoReview {
  author: string;
  country: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verifiedBuyer: boolean;
}

/**
 * Normalised review shape used across the reviews UI.
 * `source` distinguishes real DB submissions from demo sample content.
 */
export interface ReviewDTO {
  id: string;
  author: string;
  country: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  createdAt: string; // ISO date string
  source: 'customer' | 'demo';
}

const AUTHORS = [
  'Sofia M.', 'Lukas B.', 'Camille R.', 'Pedro A.', 'Emma v.d.B.', 'Marco G.',
  'Ingrid H.', 'Tomás C.', 'Anna K.', 'Julien P.', 'Marta L.', 'Nils S.',
];

const COUNTRIES = ['Portugal', 'Germany', 'France', 'Spain', 'Netherlands', 'Italy', 'Belgium', 'Sweden'];

const REVIEW_POOL: { rating: number; title: string; body: string }[] = [
  {
    rating: 5,
    title: 'Better than expected',
    body: 'The quality is honestly above the price point. Packaging was careful, delivery faster than promised, and it looks exactly like the photos. Would order again.',
  },
  {
    rating: 5,
    title: 'Transformed the room',
    body: 'Bought this to refresh our living room and the difference is huge. Assembly/setup took me under an hour with the instructions provided. Guests keep asking where it is from.',
  },
  {
    rating: 4,
    title: 'Very happy overall',
    body: 'Beautiful piece and good materials. One tiny detail: I would have liked slightly more detailed instructions, but the result is lovely and support answered my question the same day.',
  },
  {
    rating: 5,
    title: 'Exactly as pictured',
    body: 'The colour matches the website photos perfectly, which is rare. Feels sturdy and well finished. Shipping to Portugal took three working days.',
  },
  {
    rating: 4,
    title: 'Great value for the price',
    body: 'I compared several shops before ordering and this was the best combination of price and quality. The finish is consistent and it arrived well protected.',
  },
  {
    rating: 5,
    title: 'Second order from E-com.casa',
    body: 'After the first purchase I came back for a second piece. Same smooth experience: clear product page, quick delivery and quality you can feel.',
  },
  {
    rating: 4,
    title: 'Solid, warm and practical',
    body: 'Does exactly what I hoped. The natural materials make the whole corner feel calmer. Minor note: measure your space first — it is a touch bigger than I imagined.',
  },
  {
    rating: 5,
    title: 'Gift that landed perfectly',
    body: 'Ordered this as a housewarming gift and it was a hit. Elegant packaging made it feel premium without being flashy.',
  },
];

/**
 * Deterministically pick `count` reviews for a product slug.
 * Same slug always gets the same reviews (stable UI, stable tests).
 */
export function getDemoReviews(slug: string, count = 3): DemoReview[] {
  const slugHash = [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const reviews: DemoReview[] = [];
  for (let i = 0; i < count; i++) {
    const poolItem = REVIEW_POOL[(slugHash + i * 3) % REVIEW_POOL.length];
    const author = AUTHORS[(slugHash + i * 5) % AUTHORS.length];
    const country = COUNTRIES[(slugHash + i * 7) % COUNTRIES.length];
    const day = ((slugHash + i * 11) % 26) + 2;
    const month = ((slugHash + i * 4) % 8) + 1;
    reviews.push({
      author,
      country,
      rating: poolItem.rating,
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      title: poolItem.title,
      body: poolItem.body,
      verifiedBuyer: (slugHash + i) % 4 !== 0,
    });
  }
  return reviews;
}

/** Rating distribution derived from the product's average rating. */
export function getRatingBreakdown(rating: number, reviewCount: number): { stars: number; count: number; pct: number }[] {
  // Synthetic but plausible distribution centred on the product's average
  const five = Math.round(reviewCount * Math.min(0.78, Math.max(0.4, (rating - 3.2) / 1.9)));
  const four = Math.round(reviewCount * 0.18);
  const three = Math.round(reviewCount * 0.05);
  const two = Math.round(reviewCount * 0.02);
  const one = Math.max(0, reviewCount - five - four - three - two);
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = stars === 5 ? five : stars === 4 ? four : stars === 3 ? three : stars === 2 ? two : one;
    return { stars, count, pct: reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0 };
  });
}
