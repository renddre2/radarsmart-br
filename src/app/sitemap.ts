import type { MetadataRoute } from 'next';
import { getActiveOffers, getExpiredOffers, getGuides, getSiteUrl } from '@/lib/dataLoader';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const active = getActiveOffers();
  const expired = getExpiredOffers();
  const guides = getGuides();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: new Date(), changeFrequency: 'hourly', priority: 1.0 },
    { url: `${siteUrl}/comparar/`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/guias/`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/painel/`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.3 },
  ];

  const guideEntries: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${siteUrl}/guias/${g.slug}/`,
    lastModified: new Date(g.updatedAt),
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  const offerEntries: MetadataRoute.Sitemap = [...active, ...expired].map((o) => ({
    url: `${siteUrl}/oferta/${o.slug}/`,
    lastModified: new Date(o.observedAt),
    changeFrequency: 'daily',
    priority: o.status === 'active' ? 0.8 : 0.4,
  }));

  return [...staticPages, ...guideEntries, ...offerEntries];
}
