import { getProduct } from '@/lib/catalog';
import { getOfferConfig } from './registry';
import type { OfferConfig } from './types';
import type { CatalogProduct } from '@/lib/catalog/types';

export interface ResolvedOffer {
  offer: OfferConfig;
  product: CatalogProduct;
}

/**
 * Offers are campaign configurations; their commercial product comes from the
 * central catalogue. Keep the mapping here while the old offer config still
 * carries its presentation-era demo slug, so the deployed funnel can move to
 * the real ODEM product without duplicating price/stock/media logic.
 */
const CATALOG_PRODUCT_BY_OFFER: Record<string, string> = {
  'painel-ripado': 'odem-painel-ripado-acustico-carvalho',
};

export async function resolveOffer(slug: string): Promise<ResolvedOffer | null> {
  const offer = getOfferConfig(slug);
  if (!offer) return null;

  const productSlug = CATALOG_PRODUCT_BY_OFFER[offer.slug] ?? offer.productSlug;
  const product = await getProduct(productSlug);
  if (!product) return null;

  return { offer, product };
}
