import { getProduct } from '@/lib/catalog';
import { getProductOffers } from './store';
import { isOfferActive } from './promotion';
import type { OfferConfig } from './types';
import type { CatalogProduct } from '@/lib/catalog/types';

export interface ResolvedOffer {
  offer: OfferConfig;
  product: CatalogProduct;
}

function galleryFor(product: CatalogProduct): string[] {
  return [...new Set([product.image, ...product.gallery.split(',').map((value) => value.trim()).filter(Boolean)])];
}

function compact(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function firstSentence(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^.*?[.!?…](?=\s|$)/);
  return match?.[0]?.trim() || value;
}

function merchandisingSummary(product: CatalogProduct): string {
  const short = compact(product.shortDescription);
  const full = compact(product.description);
  if (short && /[.!?…]$/.test(short)) return short;
  if (full) return firstSentence(full) ?? full;
  return short ?? compact(product.name) ?? product.name;
}

export function configForProduct(product: CatalogProduct, slug: string): OfferConfig {
  const productName = compact(product.name) ?? product.name;
  const manufacturer = compact(product.manufacturer) ?? compact(product.brand) ?? 'E-com.casa';
  const brand = compact(product.brand) ?? manufacturer;
  const gallery = galleryFor(product);
  const panelLike = /painel|panel|akupanel|decowall|ripado|revestimento/i.test(
    `${productName} ${product.categorySlug} ${product.subcategorySlugs}`,
  );
  const productKind = panelLike ? 'painel' : 'produto';
  const dimensions = compact(product.dimensions);
  const materials = compact(product.materials);
  const colour = compact(product.color);
  const variantCopy = product.variants.length > 1
    ? `${product.variants.length} opções configuráveis no próprio funil.`
    : product.variants.length === 1
      ? '1 opção configurável no próprio funil.'
      : 'A configuração comercial disponível é apresentada junto ao preço.';

  const benefitDetails = [materials, colour].filter(Boolean).join(' · ');
  const description = merchandisingSummary(product);
  const fullDescription = compact(product.description) ?? description;

  return {
    slug,
    productSlug: product.slug,
    announcement: product.promoDiscountPct
      ? `Oferta temporária −${product.promoDiscountPct}% · preço aplicado automaticamente no carrinho e checkout`
      : 'Portes grátis Portugal e Espanha · Europa acima de 50 €',
    eyebrow: `${brand} · seleção E-com.casa`,
    headline: productName,
    subheadline: description,
    valueProposition: {
      title: `Do catálogo ${manufacturer}. Para a sua casa.`,
      body: `${description} A E-com.casa reúne produto, opções, campanha, carrinho e checkout num único percurso de compra.`,
    },
    transformation: {
      title: panelLike
        ? 'Textura, ritmo e acabamento que mudam a leitura do espaço.'
        : 'Um detalhe que muda a forma de sentir o espaço.',
      body: fullDescription,
      image: gallery[1] ?? gallery[0],
    },
    benefits: [
      {
        title: `Acabamento ${brand}`,
        body: benefitDetails || `Referência selecionada do catálogo ${manufacturer}.`,
      },
      {
        title: 'Escolha orientada ao projeto',
        body: [dimensions, variantCopy].filter(Boolean).join(' · '),
      },
      {
        title: 'Oferta com prazo real',
        body: product.promoEndsAt
          ? 'A campanha usa uma data final absoluta e não reinicia ao atualizar a página.'
          : 'Quando existe uma campanha ativa, o preço e o prazo são apresentados junto ao produto.',
      },
      {
        title: 'Compra centralizada',
        body: 'Preço, variante, quantidade, carrinho, pagamento e acompanhamento permanecem ligados ao catálogo central E-com.casa.',
      },
    ],
    why: {
      title: `Porque escolher este ${productKind}`,
      body: description,
      points: [
        `Fabricante: ${manufacturer}`,
        dimensions ? `Dimensões: ${dimensions}` : 'Medidas e opções apresentadas diretamente no configurador.',
        materials ? `Materiais: ${materials}` : 'Materiais e acabamento descritos na ficha do produto.',
        product.variants.length > 1
          ? `${product.variants.length} opções disponíveis para comparar antes de comprar.`
          : 'Configuração comercial apresentada antes de adicionar ao carrinho.',
      ],
    },
    installation: panelLike
      ? [
          { title: 'Medir e planear', body: 'Confirme largura, altura, orientação, remates, tomadas e margem para cortes antes de encomendar.' },
          { title: 'Preparar a superfície', body: 'A superfície deve estar sólida, limpa, seca e nivelada. Siga sempre as instruções específicas do fabricante.' },
          { title: 'Cortar e alinhar', body: 'Planeie todos os cortes antes da aplicação e utilize ferramenta adequada aos materiais do painel.' },
          { title: 'Fixar e rematar', body: 'Utilize um método de fixação compatível com a parede e finalize cantos, juntas e transições com os acessórios adequados.' },
        ]
      : [
          { title: 'Confirmar medidas', body: 'Valide dimensões, variante e quantidade antes de concluir a encomenda.' },
          { title: 'Preparar a instalação', body: 'Consulte as instruções do fabricante e confirme os acessórios necessários ao seu projeto.' },
          { title: 'Instalar', body: 'Siga o método indicado pelo fabricante e utilize ferramentas adequadas ao produto e à superfície.' },
          { title: 'Finalizar', body: 'Confirme o acabamento e os cuidados recomendados para preservar o produto.' },
        ],
    inspirationImages: gallery.slice(0, 8),
    reviews: { mode: 'none' },
    faqs: [
      {
        question: 'Como funciona esta oferta?',
        answer: 'O preço promocional é aplicado automaticamente no catálogo, no carrinho e no checkout até à data indicada. A oferta termina no prazo indicado e não reinicia ao atualizar a página.',
      },
      {
        question: 'O preço mostrado já inclui a promoção?',
        answer: 'Sim. Quando a campanha está ativa, o valor apresentado no funil é o preço comercial atual. A referência de catálogo do fornecedor aparece separadamente quando disponível.',
      },
      {
        question: 'Como escolho a medida ou acabamento?',
        answer: 'Utilize as opções apresentadas no configurador desta página. O carrinho guarda a variante selecionada e o checkout volta a validar o preço no servidor antes do pagamento.',
      },
      {
        question: 'Os acessórios estão incluídos?',
        answer: 'São vendidos separadamente, exceto quando expressamente indicados na descrição. No carrinho pode adicionar acessórios e produtos de instalação; confirme sempre a compatibilidade com a referência escolhida.',
      },
      {
        question: 'Como funciona a entrega?',
        answer: 'Portes gratuitos em Portugal e Espanha. Nos restantes destinos europeus disponíveis, os portes são gratuitos para encomendas superiores a 50 € após descontos. O prazo final depende do produto e do destino.',
      },
      {
        question: 'Posso devolver a encomenda?',
        answer: 'Consulte as condições de devolução e as exceções aplicáveis a produtos personalizados na política de devoluções E-com.casa.',
      },
    ],
    finalCta: {
      title: 'Dê o próximo passo no seu projeto.',
      body: 'Escolha a opção, confirme a quantidade e conclua a encomenda no checkout seguro E-com.casa.',
      button: 'Comprar agora',
    },
    seo: {
      title: `${productName} — Oferta`,
      description: `${description} Oferta temporária E-com.casa.`,
    },
  };
}

export async function resolveOffer(slug: string): Promise<ResolvedOffer | null> {
  const offers = await getProductOffers();
  const storedOffer = offers.find(
    (offer) => offer.slug === slug || (slug === 'painel-ripado' && offer.productSlug === 'odem-painel-ripado-acustico-carvalho'),
  );
  if (!isOfferActive(storedOffer)) return null;

  const product = await getProduct(storedOffer.productSlug);
  if (!product || !product.offerSlug) return null;

  // Keep the historical /offers/painel-ripado URL as the public flagship alias
  // while every other campaign retains the stable slug stored in ProductOffer.
  const publicSlug = slug === 'painel-ripado' ? 'painel-ripado' : storedOffer.slug;
  return { offer: configForProduct(product, publicSlug), product };
}
