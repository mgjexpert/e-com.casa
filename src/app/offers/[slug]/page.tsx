import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OfferPage } from '@/components/offers/offer-page';
import { getOfferConfig, getOfferSlugs } from '@/lib/offers/registry';
import { resolveOffer } from '@/lib/offers/resolver';
import { isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { COMPANY } from '@/lib/company';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return getOfferSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveOffer(slug);
  if (!resolved) notFound();
  const { offer, product } = resolved;
  const canonical = `/offers/${offer.slug}`;
  return {
    title: offer.seo.title,
    description: offer.seo.description,
    alternates: { canonical },
    openGraph: {
      title: offer.seo.title,
      description: offer.seo.description,
      url: canonical,
      type: 'website',
      images: product.image ? [{ url: product.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: offer.seo.title,
      description: offer.seo.description,
      images: product.image ? [product.image] : undefined,
    },
    robots: {
      index: process.env.NEXT_PUBLIC_INDEXING_ENABLED === 'true' && isCatalogProductSaleable(product),
      follow: true,
    },
  };
}

export default async function OfferRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolved = await resolveOffer(slug);
  if (!resolved) notFound();
  const { offer, product } = resolved;

  const image = product.image?.startsWith('http') ? product.image : `${COMPANY.domain}${product.image}`;
  // Intentionally no AggregateRating, Review, price Offer or availability schema
  // unless verified source data exists and the product has passed the catalogue
  // saleability gate. The UI may still demonstrate the visual review module.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: offer.seo.title,
    description: offer.seo.description,
    url: `${COMPANY.domain}/offers/${offer.slug}`,
    primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
    mainEntity: {
      '@type': 'Product',
      name: product.name,
      sku: product.sku,
      image: image ? [image] : undefined,
      description: product.shortDescription || product.description,
      brand: { '@type': 'Brand', name: COMPANY.brand },
    },
  };

  return (
    <>
      <OfferPage offer={offer} product={product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
