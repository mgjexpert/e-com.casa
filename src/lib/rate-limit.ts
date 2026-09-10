// ============================================================
// E-com.casa — Lightweight in-memory rate limiter (§87)
// ------------------------------------------------------------
// Sliding-window limiter for the checkout, payment and form
// endpoints. Local-memory per Vercel instance is acceptable for
// the current traffic profile; swap for a shared store (e.g.
// Upstash) if abuse becomes distributed. No external middleware.
// ============================================================

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < 600_000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter. Example: limit(req, 'checkout-create', 10, 60_000)
 * → max 10 requests/minute per IP for that route.
 */
export function rateLimit(
  req: Request,
  scope: string,
  max = 10,
  windowMs = 60_000,
): RateLimitResult {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const key = `${scope}:${ip}`;
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: max - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Extract client IP for webhook logging (safe fields only). */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
