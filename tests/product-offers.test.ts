import { expect, test } from 'bun:test';
import { applyCommerce } from '../src/lib/catalog/commerce';
import { applyBundleOffer, rankAccessories } from '../src/lib/catalog/bundle';
import { isOfferActive, validateProductOffer } from '../src/lib/offers/promotion';
import rows from '../data/catalog/generated-provider-products.json';
import offers from '../data/catalog/product-offers.json';
import type { CatalogProduct } from '../src/lib/catalog/types';
const products=rows as unknown as CatalogProduct[];
const offer=offers[0];const now=Date.parse(offer.startsAt)+1000;
const raw=products.find(p=>p.slug===offer.productSlug)!;
test('10 real product campaigns; both suppliers and licensed media',()=>{
 expect(offers).toHaveLength(10);expect(new Set(offers.map(o=>o.slug)).size).toBe(10);
 for(const o of offers){validateProductOffer(o);expect(products.some(p=>p.slug===o.productSlug)).toBe(true);}
 expect(offers.filter(o=>o.productSlug.startsWith('woodupp-'))).toHaveLength(5);
 expect(products.filter(p=>p.supplierKey==='woodupp').every(p=>p.image.startsWith('https://')&&p.mediaRights==='PARTNER_CONFIRMED_BY_MERCHANT')).toBe(true);
});
test('75% is the single authoritative price for every variant; OFF and expiration remove funnel',()=>{
 const p=applyCommerce({...raw,funnelOffer:offer},now);expect(p.offerSlug).toBe(offer.slug);expect(p.priceCents).toBe(Math.round(raw.priceCents*.25));
 for(let i=0;i<p.variants.length;i++)expect(p.priceCents+p.variants[i].priceDeltaCents).toBe(Math.round((raw.priceCents+raw.variants[i].priceDeltaCents)*.25));
 expect(applyCommerce(p,now+1000).priceCents).toBe(p.priceCents);
 expect(applyCommerce({...p,funnelOffer:{...offer,enabled:false}},now).offerSlug).toBeNull();
 expect(applyCommerce(p,Date.parse(offer.endsAt)).priceCents).toBe(raw.priceCents);
 expect(isOfferActive(offer,Date.parse(offer.startsAt)-1)).toBe(false);
});
test('fixed EUR price retains supplier variant supplements; validates exclusive price mode',()=>{
 const fixed={...offer,discountPct:null,fixedPriceCents:1000};validateProductOffer(fixed);
 const p=applyCommerce({...raw,funnelOffer:fixed},now);expect(p.priceCents).toBe(1000);
 expect(p.variants.map(v=>v.priceDeltaCents)).toEqual(raw.variants.map(v=>v.priceDeltaCents));
 expect(()=>validateProductOffer({...fixed,discountPct:75})).toThrow();
 expect(()=>validateProductOffer({...offer,discountPct:100})).toThrow();
 expect(()=>validateProductOffer({...offer,endsAt:offer.startsAt})).toThrow();
});
test('bundle accessory discount depends on main item, reverses on removal, and prioritizes matching brand',()=>{
 const accessory=products.find(p=>p.categorySlug==='acessorios-instalacao'&&p.brand==='WoodUpp'&&p.priceCents>0)!;
 const panel=products.find(p=>p.brand==='WoodUpp'&&p.categorySlug==='paineis-acusticos'&&p.priceCents>0)!;
 const solo=applyBundleOffer(accessory,[],now);expect(solo.promoDiscountPct).toBe(70);
 const bundle=applyBundleOffer(accessory,[panel],now);expect(bundle.priceCents).toBe(Math.round(accessory.priceCents*.25));
 expect(applyBundleOffer(bundle,[],now).priceCents).toBe(solo.priceCents);
 expect(applyBundleOffer(accessory,[accessory],now).priceCents).toBe(solo.priceCents);
 const odem=products.find(p=>p.brand==='ODEM'&&p.categorySlug==='acessorios-instalacao')!;
 expect(rankAccessories([odem,accessory],[panel])[0].slug).toBe(accessory.slug);
});
