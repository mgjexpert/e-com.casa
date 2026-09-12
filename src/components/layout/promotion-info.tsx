'use client';
import { useEffect, useState } from 'react';
import { Truck, Timer, Tag } from 'lucide-react';
import campaign from '../../../data/catalog/commerce-campaign.json';
export function PromotionInfo() {
  const [september, setSeptember] = useState(false);
  useEffect(() => {
    const update = () => setSeptember(Date.now() >= Date.parse(campaign.startsAt) && Date.now() < Date.parse(campaign.accessoriesEndsAt));
    update(); const id = setInterval(update, 60000); return () => clearInterval(id);
  }, []);
  return <aside aria-label="Ofertas e condições de entrega" className="border-b border-olive/15 bg-[#f6f5ef]">
    <div className="container-ecom grid gap-1 py-2 text-xs md:grid-cols-3 md:gap-6">
      <details className="p-2"><summary className="cursor-pointer font-semibold"><Truck className="mr-2 inline h-4 w-4" />Portes grátis · Portugal e Espanha</summary><p className="mt-2 leading-relaxed text-muted-foreground">Sem valor mínimo para Portugal e Espanha. Para os restantes destinos europeus disponíveis no checkout, portes grátis em compras superiores a 50 €, após descontos. Consulte as opções de entrega no checkout.</p></details>
      <details className="p-2"><summary className="cursor-pointer font-semibold"><Tag className="mr-2 inline h-4 w-4" />{september ? 'Setembro · acessórios com −70%' : 'Acessórios e instalação'}</summary><p className="mt-2 leading-relaxed text-muted-foreground">{september ? '70% de redução sobre o preço de catálogo do fornecedor nos acessórios e produtos de instalação, até 30 de setembro de 2026, às 23:59 (hora de Lisboa). Aplicação automática, incluindo variantes. Ao juntar acessórios a um produto principal na mesma encomenda, aplica-se 75% sobre o catálogo. Não acumulável com códigos promocionais.' : 'Encontre os complementos na categoria Acessórios e instalação ou adicione-os diretamente no carrinho.'}</p><a className="mt-2 inline-block underline" href="/shop?category=acessorios-instalacao">Explorar acessórios</a></details>
      <details className="p-2"><summary className="cursor-pointer font-semibold"><Timer className="mr-2 inline h-4 w-4" />Ofertas por tempo limitado</summary><p className="mt-2 leading-relaxed text-muted-foreground">Campanhas com início e fim definidos: ofertas rápidas de 1, 2 ou 3 horas e uma seleção de funis com −75% durante 72 horas. Cada relógio indica o prazo real, igual para todos. Após o prazo, o desconto termina. A reserva no carrinho não fixa o preço; o valor é confirmado antes do pagamento. As referências apresentadas são preços de catálogo do fornecedor, não preços anteriores desta loja.</p><a href="/offers" className="mt-2 inline-block underline">Ver ofertas em curso</a></details>
    </div>
  </aside>;
}
