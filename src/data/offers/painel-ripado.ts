import type { OfferConfig } from '@/lib/offers/types';

export const painelRipadoOffer: OfferConfig = {
  slug: 'painel-ripado',
  productSlug: 'warm-oak-slatted-wall-panel',
  markets: ['PT', 'ES', 'FR', 'DE', 'IT', 'NL'],
  announcement: 'Transforme uma parede sem transformar a casa numa obra.',
  eyebrow: 'E-com.casa · Wall Makeover',
  headline: 'Uma parede com ritmo, textura e muito mais presença.',
  subheadline:
    'Painéis ripados de acabamento quente para criar uma parede de destaque com instalação simples e um resultado visual arquitetónico.',
  valueProposition: {
    title: 'Do “falta qualquer coisa” ao espaço que parece finalmente terminado.',
    body:
      'O efeito ripado acrescenta profundidade sem pesar a divisão. Funciona atrás do sofá, da cama, da televisão ou da secretária — e combina especialmente bem com madeira, pedra, tecidos naturais e luz quente.',
  },
  transformation: {
    title: 'Textura que muda a leitura da divisão.',
    body:
      'As linhas verticais alongam visualmente a parede, criam sombra e dão um enquadramento mais intencional ao mobiliário. O resultado é mais editorial, sem exigir uma remodelação completa.',
    image: '/images/gallery-wood-slat-panel-lifestyle.jpg',
  },
  benefits: [
    {
      title: 'Impacto imediato',
      body: 'Uma única parede de destaque pode redefinir a sala, quarto ou escritório sem substituir o restante mobiliário.',
    },
    {
      title: 'Visual quente e contemporâneo',
      body: 'A repetição das ripas introduz detalhe e profundidade mantendo uma linguagem calma, natural e fácil de combinar.',
    },
    {
      title: 'Instalação acessível',
      body: 'Os painéis foram pensados para alinhar lado a lado e podem ser cortados à medida por um instalador ou DIY experiente.',
    },
    {
      title: 'Conforto acústico',
      body: 'A base em feltro ajuda a suavizar reflexões sonoras em espaços com muitas superfícies duras.',
    },
  ],
  why: {
    title: 'Porque este tipo de parede funciona tão bem',
    body:
      'Não depende de uma tendência isolada. É uma combinação de proporção, material e sombra: três elementos que continuam a funcionar mesmo quando muda o sofá, a iluminação ou a decoração.',
    points: [
      'Cria um ponto focal sem ocupar área útil.',
      'Ajuda a integrar TV, cabeceira, secretária ou aparador.',
      'Pode ser aplicado numa parede completa ou apenas numa faixa.',
      'Permite repetir a mesma linguagem em diferentes divisões.',
    ],
  },
  installation: [
    {
      title: 'Medir e planear',
      body: 'Confirme largura, altura, tomadas e remates antes do primeiro corte. Faça uma composição a seco sempre que possível.',
    },
    {
      title: 'Cortar à medida',
      body: 'Ajuste os painéis à altura e aos obstáculos usando ferramenta adequada ao suporte e ao acabamento.',
    },
    {
      title: 'Fixar e alinhar',
      body: 'Instale a partir de uma referência perfeitamente vertical e mantenha o espaçamento entre painéis consistente.',
    },
    {
      title: 'Rematar',
      body: 'Finalize cantos, rodapés, tomadas e transições para que o conjunto pareça parte integrante da arquitetura.',
    },
  ],
  inspirationImages: [
    '/images/product-wood-slat-panel.jpg',
    '/images/gallery-wood-slat-panel-lifestyle.jpg',
    '/images/gallery-wood-slat-panel-detail.jpg',
  ],
  reviews: {
    mode: 'demo',
    rating: 4.8,
    count: 220,
    satisfactionCopy: 'O motor suporta rating, distribuição e reviews verificadas. Os números desta configuração são apenas uma pré-visualização de layout e não são publicados como dados estruturados.',
    reviews: [],
  },
  faqs: [
    {
      question: 'Posso instalar apenas numa parte da parede?',
      answer: 'Sim. Uma faixa vertical atrás de uma TV, cama, aparador ou secretária pode funcionar como elemento de enquadramento sem revestir a parede inteira.',
    },
    {
      question: 'Os painéis podem ser cortados?',
      answer: 'Sim, desde que utilize ferramentas adequadas aos materiais do painel e faça o corte com suporte suficiente. Meça duas vezes antes de cortar.',
    },
    {
      question: 'É indicado para zonas molhadas?',
      answer: 'Não assumimos resistência à água sem documentação específica do produto. Evite contacto direto com água e confirme a ficha técnica antes de usar em cozinhas húmidas ou casas de banho.',
    },
    {
      question: 'Como calculo quantos painéis preciso?',
      answer: 'Divida a largura útil da parede pela largura do painel e arredonde para cima, acrescentando margem para cortes, remates e eventuais perdas.',
    },
    {
      question: 'Posso comprar já?',
      answer: 'O botão de compra só é ativado quando o produto associado está aprovado no catálogo, com fornecedor, stock e documentação aplicável validados. A Offer nunca contorna essas regras.',
    },
  ],
  finalCta: {
    title: 'Dê estrutura à parede que hoje passa despercebida.',
    body: 'Escolha o acabamento, confirme as medidas e use o mesmo carrinho e checkout seguro da E-com.casa quando o produto estiver comercialmente aprovado.',
    button: 'Ver disponibilidade',
  },
  seo: {
    title: 'Painel Ripado para Parede — Transformação Interior',
    description: 'Descubra a proposta E-com.casa para uma parede ripada de visual quente e contemporâneo, com especificações, instalação e integração com o catálogo real.',
  },
};
