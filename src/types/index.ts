export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string;
  price: string;
  comparePrice: string | null;
  currency: string;
  categorySlug: string;
  spaceSlugs: string;
  styleSlugs: string;
  collectionSlugs: string;
  image: string;
  hoverImage: string | null;
  badge: string | null;
  rating: number;
  reviewCount: number;
  stock: number;
  isBestSeller: boolean;
  isNew: boolean;
  featured: boolean;
  materials: string | null;
  dimensions: string | null;
  care: string | null;
  color: string | null;
  electrical: boolean;
  complianceStatus: string;
  safetyJson: string | null;
  createdAt: string;
}

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
  paymentMethod: string;
  subtotal: string;
  shipping: string;
  tax: string;
  discount: string;
  total: string;
  promoCode: string | null;
  itemsJson: string;
  status: string;
  paymentStatus: string;
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
}
