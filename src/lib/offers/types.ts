export type OfferReviewMode = 'verified' | 'demo' | 'none';

export interface OfferBenefit {
  title: string;
  body: string;
}

export interface OfferFAQItem {
  question: string;
  answer: string;
}

export interface OfferInstallationStep {
  title: string;
  body: string;
}

export interface OfferReviewItem {
  author: string;
  location?: string;
  date?: string;
  rating: number;
  body: string;
  image?: string;
  verified?: boolean;
}

export interface OfferReviewConfig {
  mode: OfferReviewMode;
  rating?: number;
  count?: number;
  satisfactionCopy?: string;
  reviews?: OfferReviewItem[];
}

export interface OfferConfig {
  slug: string;
  productSlug: string;
  markets?: string[];
  announcement: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  valueProposition: {
    title: string;
    body: string;
  };
  transformation: {
    title: string;
    body: string;
    image?: string;
  };
  beforeAfter?: {
    title: string;
    beforeImage: string;
    afterImage: string;
    beforeLabel?: string;
    afterLabel?: string;
  };
  benefits: OfferBenefit[];
  why: {
    title: string;
    body: string;
    points: string[];
  };
  installation: OfferInstallationStep[];
  inspirationImages?: string[];
  reviews: OfferReviewConfig;
  faqs: OfferFAQItem[];
  finalCta: {
    title: string;
    body: string;
    button: string;
  };
  seo: {
    title: string;
    description: string;
  };
}
