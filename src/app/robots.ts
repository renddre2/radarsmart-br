import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/dataLoader';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/ir/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
