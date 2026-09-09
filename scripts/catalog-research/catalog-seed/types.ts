// ============================================================
// E-com.casa — Curated demo catalogue archetype types
// ============================================================

export interface Archetype {
  key: string;
  name: string;
  subtitle: string;
  category: string;
  subcategories: string[];
  spaces: string[];
  styles: string[];
  collections: string[];
  priceCents: number;
  materials: string[];
  colour: string;
  dimensions: string;
  weight?: string;
  care: string;
  electrical?: boolean;
  battery?: boolean;
  shippingClass: 'SMALL' | 'STANDARD' | 'FRAGILE' | 'OVERSIZED' | 'HEAVY' | 'SPECIAL';
  imageKey: string;
  badge?: 'New' | 'Featured' | 'Popular' | "Editor's Pick" | 'Best Seller';
  isNew?: boolean;
  isBestSeller?: boolean;
  featured?: boolean;
  variants?: Array<{ type: 'colour' | 'size' | 'pack' | 'material'; name: string; value: string; deltaCents?: number }>;
  copy: {
    intro: string;
    benefits: string[];
    use: string;
  };
  /** Research-type keywords used to link candidates from the research run */
  matchKeywords: string[];
}

