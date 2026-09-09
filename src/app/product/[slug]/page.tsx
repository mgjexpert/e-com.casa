import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { BuyBox } from '@/components/product/buy-box';
import { ProductCard } from '@/components/product/product-card';
import { Stars } from '@/components/product/product-card';
import { formatPrice } from '@/lib/format';
import { COMPANY } from '@/lib/company';
import type { Product } from '@/types';
import { ChevronRight, Package, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const product = await db.product.findUnique({ where: { slug } });
    if (!product || product.complianceStatus === 'BLOCKED') return null;
    return product as unknown as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: `${product.name} — ${formatPrice(product.price)}`,
    description: product.description.slice(0, 155),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 155),
      images: [{ url: product.image }],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const styleSlugs = product.styleSlugs.split(',').filter(Boolean);
  const spaceSlugs = product.spaceSlugs.split(',').filter(Boolean);
  const relatedStyle = styleSlugs[0] ?? spaceSlugs[0];

  let related: Product[] = [];
  try {
    const candidates = await db.product.findMany({
      where: {
        slug: { not: product.slug },
        complianceStatus: { not: 'BLOCKED' },
        OR: [
          ...(relatedStyle ? [{ styleSlugs: { contains: relatedStyle } }] : []),
          { categorySlug: product.categorySlug },
        ],
      },
      take: 4,
    });
    related = candidates as unknown as Product[];
  } catch {
    related = [];
  }

  let safety: {
    productIdentifier?: string;
    manufacturerName?: string;
    manufacturerAddress?: string;
    manufacturerEmail?: string;
    euResponsiblePerson?: string;
    warnings?: string;
    safetyInstructions?: string;
    ceMarking?: string;
    countryOfOrigin?: string;
  } | null = null;
  try {
    safety = product.safetyJson ? JSON.parse(product.safetyJson) : null;
  } catch {
    safety = null;
  }

  return (
    <div className="container-ecom py-8 lg:py-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-[12px] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li><Link href="/shop" className="hover:text-foreground">Shop</Link></li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li><Link href={`/shop?category=${product.categorySlug}`} className="capitalize hover:text-foreground">{product.categorySlug.replace(/-/g, ' ')}</Link></li>
          <li aria-hidden><ChevronRight className="h-3 w-3" /></li>
          <li className="text-foreground/80">{product.name}</li>
        </ol>
      </nav>

      {/* Gallery + info */}
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/30">
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
            {product.badge && (
              <span className="absolute left-4 top-4 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream backdrop-blur">
                {product.badge}
              </span>
            )}
          </div>
          <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
            Lifestyle photography — colours may vary slightly in person.
          </p>
        </div>

        <div>
          <h1 className="font-display text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
            {product.name}
          </h1>
          {product.subtitle && <p className="mt-1.5 text-[14px] text-muted-foreground">{product.subtitle}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Stars rating={product.rating} />
            <span className="text-[13px] font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-[13px] text-muted-foreground">· {product.reviewCount} reviews</span>
          </div>

          <p className="mt-5 text-[14.5px] leading-relaxed text-foreground/85">{product.description}</p>

          <div className="mt-7">
            <BuyBox product={product} />
          </div>

          {/* Styles & spaces chips */}
          {(styleSlugs.length > 0 || spaceSlugs.length > 0) && (
            <div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5">
              {styleSlugs.map((s) => (
                <Link
                  key={s}
                  href={`/shop?style=${s}`}
                  className="rounded-full border border-border bg-cream/60 px-3 py-1.5 text-[12px] font-medium capitalize text-foreground/75 transition-colors hover:border-olive hover:text-olive"
                >
                  {s.replace(/-/g, ' ')}
                </Link>
              ))}
              {spaceSlugs.map((s) => (
                <Link
                  key={s}
                  href={`/shop?space=${s}`}
                  className="rounded-full border border-border bg-cream/60 px-3 py-1.5 text-[12px] font-medium capitalize text-foreground/75 transition-colors hover:border-olive hover:text-olive"
                >
                  {s.replace(/-/g, ' ')}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="font-display text-[22px] font-medium">Product details</h2>
          <dl className="mt-5 divide-y divide-border rounded-lg border border-border">
            {[
              { label: 'Materials', value: product.materials },
              { label: 'Dimensions', value: product.dimensions },
              { label: 'Care', value: product.care },
              { label: 'Colour', value: product.color },
            ]
              .filter((row) => row.value)
              .map((row) => (
                <div key={row.label} className="grid grid-cols-[130px_1fr] gap-4 px-5 py-3.5">
                  <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{row.label}</dt>
                  <dd className="text-[13.5px] leading-relaxed text-foreground/85">{row.value}</dd>
                </div>
              ))}
            <div className="grid grid-cols-[130px_1fr] gap-4 px-5 py-3.5">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Delivery</dt>
              <dd className="text-[13.5px] leading-relaxed text-foreground/85">
                Standard 3–5 working days (free over €50) · Express 1–2 days ·{' '}
                <Link href="/shipping" className="text-olive underline underline-offset-2">shipping details</Link>
              </dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4 px-5 py-3.5">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Returns</dt>
              <dd className="text-[13.5px] leading-relaxed text-foreground/85">
                14-day right of withdrawal ·{' '}
                <Link href="/returns" className="text-olive underline underline-offset-2">how to return</Link>
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="safety-heading">
          <h2 id="safety-heading" className="font-display text-[22px] font-medium">Safety &amp; Compliance</h2>
          <div className="mt-5 rounded-lg border border-border bg-cream/50 p-5">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-olive" strokeWidth={1.5} />
              Product safety information under the EU General Product Safety Regulation. Values marked
              [TO BE COMPLETED] are placeholders pending supplier documentation — they are never invented.
            </p>
            {safety && (
              <dl className="mt-4 space-y-2.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Product identifier</dt>
                  <dd className="text-right font-medium">{safety.productIdentifier ?? product.slug}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Manufacturer</dt>
                  <dd className="text-right font-medium">{safety.manufacturerName ?? '[TO BE COMPLETED]'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">EU responsible person</dt>
                  <dd className="text-right font-medium">{safety.euResponsiblePerson ?? '[TO BE COMPLETED]'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Warnings</dt>
                  <dd className="max-w-[65%] text-right leading-relaxed">{safety.warnings ?? 'See enclosed manual.'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Compliance status</dt>
                  <dd className="text-right">
                    <span className="rounded-full bg-olive/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-olive">
                      {product.complianceStatus.replace(/_/g, ' ')}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Questions on safety</dt>
                  <dd className="text-right">
                    <a href={`mailto:${COMPANY.emails.compliance}`} className="text-olive underline underline-offset-2">
                      {COMPANY.emails.compliance}
                    </a>
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </section>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16 border-t border-border pt-12">
          <div className="flex items-end justify-between">
            <h2 id="related-heading" className="font-display text-[24px] font-medium">You may also like</h2>
            <Link href="/shop" className="text-[13px] font-medium text-foreground/70 hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Product structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            image: `${COMPANY.domain}${product.image}`,
            description: product.description,
            sku: product.slug.toUpperCase(),
            brand: { '@type': 'Brand', name: COMPANY.brand },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.rating,
              reviewCount: product.reviewCount,
            },
            offers: {
              '@type': 'Offer',
              url: `${COMPANY.domain}/product/${product.slug}`,
              priceCurrency: product.currency,
              price: product.price,
              availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            },
          }),
        }}
      />
    </div>
  );
}
