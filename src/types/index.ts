// Product is now the catalog domain type — the single source of truth
// shared by the catalog service adapters (see src/lib/catalog/types.ts).
export type { CatalogProduct as Product, ProductVariant } from '@/lib/catalog/types';

export interface Category {
  id: string;
  slug: string;
  name: string;
  type: 'space' | 'style' | 'collection' | 'shop';
  image: string | null;
  subtitle: string | null;
  sortOrder: number;
}

export interface OrderItem {
  slug: string;
  name: string;
  subtitle: string | null;
  price: string;
  quantity: number;
  image: string;
  variantLabel?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  address2: string | null;
  city: string;
  postalCode: string;
  country: string;
  phone: string | null;
  shippingMethod: string;
  paymentMethod?: string | null;
  subtotal: string;
  shipping: string;
  tax: string;
  discount: string;
  total: string;
  promoCode: string | null;
  itemsJson: string;
  giftWrap: boolean;
  notes: string | null;
  status: string;
  /** PENDING_PAYMENT | PAYMENT_PROCESSING | PAID | PAYMENT_FAILED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED */
  paymentStatus: string;
  paymentMethodType?: string | null;
  currency?: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface CartLine {
  slug: string;
  name: string;
  subtitle: string | null;
  price: string;
  image: string;
  quantity: number;
  maxStock: number;
  /** Optional selected variant (cart identity = slug + variantId) */
  variantId?: string;
  variantLabel?: string;
}
