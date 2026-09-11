import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgePercent, Clock3 } from 'lucide-react';
import { getOfferSlugs } from '@/lib/offers/registry';
import { resolveOffer } from '@/lib/offers/resolver';
import { toStorefrontProduct } from '@/lib/catalog/public-product';

export const metadata: Metadata = {
  title: 'Ofertas em curso | E-com.casa',
  description: 'Campanhas e ofertas promocionais E-com.casa atualmente disponíveis.',
  alternates: { canonical: '/offers' },
};

export const dynamic = 'force-dynamic';

export default async function OffersIndexPage() {
  const resolved = (await Promise.all(getOfferSlugs().map((slug) => resolveOffer(slug)))).filter(
    (value): value is NonNullable<typeof value> => Boolean(value),
  );

  return (
    <main className="bg-[#f7f3ef] text-[#201a17]">
      <section className="border-b border-[#e1d8ce] bg-[#201a17] px-4 py-14 text-[#f7f3ef] sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#c79a68]">E-com.casa · Offers</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] sm:text-6xl">Ofertas promocionais em curso.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#cbbbaf]">Seleções temporárias com preço de campanha, conteúdo dedicado ao produto e o mesmo checkout seguro da E-com.casa.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {resolved.length === 0 ? (
          <div className="rounded-xl border border-[#ddd3c8] bg-white p-10 text-center"><Clock3 className="mx-auto h-6 w-6 text-[#8a5a2b]" /><h2 className="mt-4 font-display text-2xl">Não existem campanhas ativas neste momento.</h2><Link href="/shop" className="mt-6 inline-flex rounded-full bg-[#201a17] px-6 py-3 text-sm font-semibold text-white">Ver catálogo</Link></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {resolved.map(({ offer, product }) => {
              const publicProduct = toStorefrontProduct(product);
              const isPanel = offer.slug === 'painel-ripado';
              const campaignPrice = isPanel ? 5 : publicProduct.priceCents / 100;
              return (
                <article key={offer.slug} className="overflow-hidden rounded-2xl border border-[#ddd3c8] bg-[#fffdf9] shadow-[0_12px_35px_rgba(32,26,23,.06)]">
                  <Link href={`/offers/${offer.slug}`} className="group block">
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#e8e0d7]">
                      <Image src={publicProduct.image} alt={publicProduct.name} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" />
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#201a17] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-white"><BadgePercent className="h-3.5 w-3.5" />Oferta ativa</span>
                    </div>
                    <div className="p-6 sm:p-7">
                      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#8a5a2b]">{offer.eyebrow}</p>
                      <h2 className="mt-2 font-display text-3xl leading-tight">{isPanel ? 'Painel Ripado Decorativo' : publicProduct.name}</h2>
                      <p className="mt-3 text-sm leading-6 text-[#675b53]">{offer.subheadline}</p>
                      <div className="mt-5 flex items-end justify-between gap-4 border-t border-[#e6ded4] pt-5">
                        <div><span className="block text-[11px] text-[#83766d]">Oferta desde</span><strong className="text-2xl">{campaignPrice.toFixed(2).replace('.', ',')} €</strong>{isPanel && <span className="ml-2 text-xs text-[#83766d] line-through">20,00 €</span>}</div>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">Ver oferta <ArrowRight className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-[#eee6dc] px-6 py-3 text-right sm:px-7"><Link href={`/product/${publicProduct.slug}`} className="text-xs text-[#7d6f64] underline underline-offset-4">Ver produto no catálogo</Link></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
