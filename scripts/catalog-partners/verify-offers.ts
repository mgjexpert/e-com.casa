import { db } from '../../src/lib/db';
import { applyCommerce } from '../../src/lib/catalog/commerce';
import { mapProduct } from '../../src/lib/catalog/prisma-adapter';
import { validateProductOffer, isOfferActive } from '../../src/lib/offers/promotion';
try {
  const offers = await db.productOffer.findMany();
  for (const row of offers) {
    const offer = { ...row, startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString() };
    validateProductOffer(offer);
    const product=await db.product.findUniqueOrThrow({where:{slug:row.productSlug}});
    const priced=applyCommerce({...mapProduct(product),funnelOffer:offer});
    if (isOfferActive(offer) && !priced.offerSlug) throw Error('Active offer missing from product');
  }
  console.log(JSON.stringify({ offers:offers.length, enabled:offers.filter(o=>o.enabled).length, licensedWoodUpp:await db.product.count({where:{supplierKey:'woodupp',imageStatus:'LICENSED'}}), auditTable:await db.productOfferAudit.count()>=0 }));
} finally {await db.$disconnect();}
