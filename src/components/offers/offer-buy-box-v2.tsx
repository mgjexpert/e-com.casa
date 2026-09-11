'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Zap, ShieldCheck } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { useLanguage } from '@/lib/language-store';
import { formatPrice } from '@/lib/format';
import { getCatalogSaleabilityLabel, isCatalogProductSaleable } from '@/lib/catalog/saleability';
import { trackOfferEvent } from '@/lib/offers/analytics';
import type { CatalogProduct } from '@/lib/catalog/types';
import type { OfferLanguage } from '@/lib/offers/types';
import { cn } from '@/lib/utils';

const BUY_COPY: Record<OfferLanguage, { current: string; reference: string; inStock: string; finish: string; decrease: string; increase: string; buyNow: string; validating: string; add: string; wait: string; note: string }> = {
  pt: { current: 'Preço atual', reference: 'Preço de referência do catálogo', inStock: 'Em stock', finish: 'Acabamento', decrease: 'Diminuir quantidade', increase: 'Aumentar quantidade', buyNow: 'Comprar agora', validating: 'Compra em validação', add: 'Adicionar ao carrinho', wait: 'Aguardar validação do produto', note: 'A Offer reutiliza o catálogo, carrinho, checkout e XPayments existentes. Nenhum preço ou pagamento é criado em paralelo.' },
  en: { current: 'Current price', reference: 'Catalogue reference price', inStock: 'In stock', finish: 'Finish', decrease: 'Decrease quantity', increase: 'Increase quantity', buyNow: 'Buy now', validating: 'Purchase under validation', add: 'Add to cart', wait: 'Await product validation', note: 'This Offer reuses the existing catalogue, cart, checkout and XPayments flow. No parallel price or payment system is created.' },
  es: { current: 'Precio actual', reference: 'Precio de referencia del catálogo', inStock: 'En stock', finish: 'Acabado', decrease: 'Reducir cantidad', increase: 'Aumentar cantidad', buyNow: 'Comprar ahora', validating: 'Compra en validación', add: 'Añadir al carrito', wait: 'Esperar validación del producto', note: 'Esta Offer reutiliza catálogo, carrito, checkout y XPayments. No crea precios ni pagos paralelos.' },
  fr: { current: 'Prix actuel', reference: 'Prix de référence du catalogue', inStock: 'En stock', finish: 'Finition', decrease: 'Réduire la quantité', increase: 'Augmenter la quantité', buyNow: 'Acheter maintenant', validating: 'Achat en validation', add: 'Ajouter au panier', wait: 'Attendre la validation du produit', note: 'Cette Offer réutilise le catalogue, le panier, le paiement et XPayments existants. Aucun système parallèle de prix ou de paiement.' },
  de: { current: 'Aktueller Preis', reference: 'Katalog-Referenzpreis', inStock: 'Auf Lager', finish: 'Ausführung', decrease: 'Menge verringern', increase: 'Menge erhöhen', buyNow: 'Jetzt kaufen', validating: 'Kauf wird geprüft', add: 'In den Warenkorb', wait: 'Produktfreigabe abwarten', note: 'Diese Offer nutzt den bestehenden Katalog, Warenkorb, Checkout und XPayments. Es entsteht kein paralleles Preis- oder Zahlungssystem.' },
  it: { current: 'Prezzo attuale', reference: 'Prezzo di riferimento del catalogo', inStock: 'Disponibile', finish: 'Finitura', decrease: 'Riduci quantità', increase: 'Aumenta quantità', buyNow: 'Acquista ora', validating: 'Acquisto in verifica', add: 'Aggiungi al carrello', wait: 'Attendi validazione prodotto', note: 'Questa Offer riutilizza catalogo, carrello, checkout e XPayments esistenti. Non crea prezzi o pagamenti paralleli.' },
  nl: { current: 'Huidige prijs', reference: 'Referentieprijs uit catalogus', inStock: 'Op voorraad', finish: 'Afwerking', decrease: 'Aantal verlagen', increase: 'Aantal verhogen', buyNow: 'Nu kopen', validating: 'Aankoop wordt gevalideerd', add: 'In winkelwagen', wait: 'Wacht op productvalidatie', note: 'Deze Offer hergebruikt de bestaande catalogus, winkelwagen, checkout en XPayments. Er wordt geen parallel prijs- of betaalsysteem gemaakt.' },
};

export function OfferBuyBoxV2({ product, offerSlug, initialLanguage }: { product: CatalogProduct; offerSlug: string; initialLanguage: OfferLanguage }) {
  const router = useRouter();
  const langStore = useLanguage((state) => state.lang);
  const lang = (['en', 'pt', 'fr', 'de', 'es', 'it', 'nl'].includes(langStore) ? langStore : initialLanguage) as OfferLanguage;
  const text = BUY_COPY[lang] ?? BUY_COPY.en;
  const add = useCart((state) => state.add);
  const openCartDrawer = useCartDrawer((state) => state.open);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(product.variants[0]?.id);
  const saleable = isCatalogProductSaleable(product);
  const selectedVariant = useMemo(() => product.variants.find((variant) => variant.id === variantId) ?? product.variants[0], [product.variants, variantId]);
  const unitPriceCents = product.priceCents + (selectedVariant?.priceDeltaCents ?? 0);
  const unitPrice = (unitPriceCents / 100).toFixed(2);

  const selectVariant = (id: string) => {
    setVariantId(id);
    trackOfferEvent('variant_selected', { offerSlug, productSlug: product.slug, variantId: id });
  };
  const setQty = (next: number) => {
    const max = saleable ? Math.max(1, product.stock) : 20;
    const value = Math.min(max, Math.max(1, next));
    setQuantity(value);
    trackOfferEvent('quantity_changed', { offerSlug, productSlug: product.slug, quantity: value });
  };
  const addLine = () => {
    if (!saleable) return;
    add({ slug: product.slug, name: product.name, subtitle: selectedVariant ? `${product.subtitle ? `${product.subtitle} · ` : ''}${selectedVariant.name}` : product.subtitle, price: unitPrice, image: product.image, maxStock: product.stock, variantId: selectedVariant?.id, variantLabel: selectedVariant?.name }, quantity);
  };
  const addToCart = () => {
    if (!saleable) return;
    addLine();
    trackOfferEvent('add_to_cart', { offerSlug, productSlug: product.slug, variantId: selectedVariant?.id, quantity, value: (unitPriceCents * quantity) / 100, currency: product.currency });
    openCartDrawer();
  };
  const buyNow = () => {
    if (!saleable) return;
    addLine();
    trackOfferEvent('begin_checkout', { offerSlug, productSlug: product.slug, variantId: selectedVariant?.id, quantity, value: (unitPriceCents * quantity) / 100, currency: product.currency });
    router.push('/checkout');
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-[0_20px_60px_rgba(38,35,29,0.08)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{saleable ? text.current : text.reference}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{formatPrice(unitPrice)}</p>
        </div>
        {saleable ? <span className="rounded-full bg-olive/10 px-3 py-1.5 text-[11px] font-semibold text-olive">{text.inStock}</span> : <span className="rounded-full bg-amber-star/10 px-3 py-1.5 text-[11px] font-semibold text-foreground/70">{getCatalogSaleabilityLabel(product)}</span>}
      </div>

      {product.variants.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text.finish}</p>
            {selectedVariant && <span className="text-[12px] text-foreground/70">{selectedVariant.name}</span>}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={text.finish}>
            {product.variants.map((variant) => {
              const active = selectedVariant?.id === variant.id;
              return <button key={variant.id} type="button" role="radio" aria-checked={active} onClick={() => selectVariant(variant.id)} className={cn('min-h-11 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-all', active ? 'border-olive bg-olive/5 text-olive shadow-sm' : 'border-border bg-background hover:border-olive/40')}>{variant.name}</button>;
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <div className="flex h-12 items-center rounded-lg border border-input bg-background">
          <button type="button" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1} className="grid h-full w-11 place-items-center disabled:opacity-35" aria-label={text.decrease}><Minus className="h-4 w-4" /></button>
          <span className="w-9 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQty(quantity + 1)} disabled={saleable && quantity >= product.stock} className="grid h-full w-11 place-items-center disabled:opacity-35" aria-label={text.increase}><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={buyNow} disabled={!saleable} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-45"><Zap className="h-4 w-4" />{saleable ? text.buyNow : text.validating}</button>
      </div>

      <button type="button" onClick={addToCart} disabled={!saleable} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink/20 bg-background text-[13px] font-semibold transition hover:border-ink/50 disabled:cursor-not-allowed disabled:opacity-45"><ShoppingBag className="h-4 w-4" />{saleable ? text.add : text.wait}</button>

      <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-olive" /><p>{text.note}</p></div>
    </div>
  );
}
