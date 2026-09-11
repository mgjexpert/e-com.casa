import { getProduct } from '@/lib/catalog';
import { getOfferConfig } from './registry';
import type { OfferConfig } from './types';
import type { CatalogProduct } from '@/lib/catalog/types';

export interface ResolvedOffer {
  offer: OfferConfig;
  product: CatalogProduct;
}

export async function resolveOffer(slug: string): Promise<ResolvedOffer | null> {
  const offer = getOfferConfig(slug);
  if (!offer) return null;
  const product = await getProduct(offer.productSlug);
  if (!product) return null;
  return { offer, product };
}
