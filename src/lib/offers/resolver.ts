import { getProduct } from '@/lib/catalog';
import { getProductOffers } from './store';
import { isOfferActive } from './promotion';
import { db } from '@/lib/db';
import { cache } from 'react';
import type { OfferConfig, OfferReviewItem } from './types';
import type { CatalogProduct } from '@/lib/catalog/types';
export interface ResolvedOffer { offer: OfferConfig; product: CatalogProduct }
export function configForProduct(product: CatalogProduct, slug: string, reviews: OfferReviewItem[] = []): OfferConfig {
  return {
    slug, productSlug: product.slug,
    announcement: 'Portes grátis Portugal e Espanha · Europa acima de 50 €',
    eyebrow: `${product.brand ?? 'E-com.casa'} · Oferta promocional`,
    headline: product.name, subheadline: product.shortDescription,
    valueProposition: { title: 'Escolha o acabamento. Transforme o seu espaço.', body: product.shortDescription },
    transformation: { title: 'Detalhes que fazem a diferença.', body: product.description, image: product.image },
    benefits: [], why: { title: 'Do fabricante para o seu projeto.', body: product.shortDescription, points: [] },
    installation: [], inspirationImages: product.gallery.split(',').filter(Boolean),
    reviews: reviews.length ? { mode: 'verified', reviews } : { mode: 'none' },
    faqs: [
      { question: 'Como funciona esta oferta?', answer: 'O preço promocional é aplicado automaticamente no catálogo, no carrinho e no checkout até à data indicada. A referência apresentada corresponde ao catálogo do fornecedor. A oferta termina no prazo indicado e não reinicia ao atualizar a página.' },
      { question: 'Os acessórios estão incluídos?', answer: 'São vendidos separadamente, exceto quando expressamente indicados na descrição. No carrinho pode escolher acessórios e produtos de instalação. Confirme a compatibilidade com o seu produto.' },
      { question: 'Como funciona a entrega?', answer: 'Portes gratuitos em Portugal e Espanha. Nos restantes destinos europeus disponíveis, portes gratuitos para encomendas superiores a 50 € após descontos. A encomenda é de fabricação direta; o prazo depende do produto e destino.' },
      { question: 'Posso devolver a encomenda?', answer: 'Consulte as condições de devolução e as exceções aplicáveis a produtos personalizados na nossa política de devoluções.' },
    ],
    finalCta: { title: 'O próximo passo para o seu espaço.', body: 'Escolha a opção e a quantidade para concluir a encomenda.', button: 'Comprar agora' },
    seo: { title: `${product.name} — Oferta | E-com.casa`, description: `${product.shortDescription.slice(0,120)} Oferta temporária E-com.casa.` },
  };
}
export const resolveOffer = cache(async (slug: string): Promise<ResolvedOffer | null> => {
  const offers = await getProductOffers();
  const offer = offers.find(o => o.slug === slug || (slug === 'painel-ripado' && o.productSlug === 'odem-painel-ripado-acustico-carvalho'));
  if (!isOfferActive(offer)) return null;
  const product = await getProduct(offer.productSlug);
  if (!product || !product.offerSlug) return null;
  const reviews = await db.review.findMany({
    where: { productSlug: product.slug, status: 'APPROVED', verified: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // Preserve the public alias requested by the customer (notably
  // /offers/painel-ripado) while the underlying DB offer keeps its stable
  // product-based slug. This keeps canonical/share links and attribution on
  // the URL that was actually opened.
  return {
    offer: configForProduct(product, slug, reviews.map((review) => ({
      author: review.author,
      location: review.country,
      date: review.createdAt.toISOString().slice(0, 10),
      rating: review.rating,
      body: review.body,
      verified: true,
    }))),
    product,
  };
});
