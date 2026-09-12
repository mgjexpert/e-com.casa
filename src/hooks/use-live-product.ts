'use client';
import { useEffect, useState } from 'react';
import type { CatalogProduct } from '@/lib/catalog/types';
import { applyCommerce } from '@/lib/catalog/commerce';
/** Keep displayed prices and variant deltas aligned when a fixed offer expires. */
export function useLiveProduct(initial: CatalogProduct): CatalogProduct {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!initial.promoEndsAt) return;
    const update = () => setExpired(Date.now() >= Date.parse(initial.promoEndsAt!));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [initial.promoEndsAt]);
  return expired ? applyCommerce(initial) : initial;
}
