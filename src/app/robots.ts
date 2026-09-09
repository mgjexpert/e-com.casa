import type { MetadataRoute } from 'next';
import { COMPANY } from '@/lib/company';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/checkout/success', '/account/'],
      },
    ],
    sitemap: `${COMPANY.domain}/sitemap.xml`,
    host: COMPANY.domain,
  };
}
