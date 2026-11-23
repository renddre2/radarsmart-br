import fs from 'node:fs/promises';
import path from 'node:path';
import type { GeneratedGuide, NormalizedOffer, OpsReport } from '../src/types/domain';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const root = process.cwd();
  const dataDir = path.join(root, 'data');
  const publicDir = path.join(root, 'public');
  const apiDir = path.join(publicDir, 'api');
  await fs.mkdir(apiDir, { recursive: true });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://renddre2.github.io/radarsmart-br').replace(/\/$/, '');
  const offers = await readJson<NormalizedOffer[]>(path.join(dataDir, 'offers.json'), []);
  const guides = await readJson<GeneratedGuide[]>(path.join(dataDir, 'guides.json'), []);
  const opsReport = await readJson<OpsReport | null>(path.join(dataDir, 'ops-report.json'), null);

  // Public lightweight JSON endpoints for external integrations / Make / Zapier / Telegram / bots
  await fs.writeFile(
    path.join(apiDir, 'deals.json'),
    `${JSON.stringify(
      {
        updatedAt: opsReport?.executedAt ?? new Date().toISOString(),
        total: offers.length,
        offers: offers.map((o) => ({
          id: o.id,
          slug: o.slug,
          title: o.title,
          brand: o.brand,
          condition: o.condition,
          storeName: o.storeName,
          price: o.effectivePrice,
          listPrice: o.listPrice,
          discountPct: o.priceStats.verifiedDiscountPct,
          opportunityScore: o.opportunityScore,
          url: `${siteUrl}/oferta/${o.slug}/`,
          directStoreUrl: o.monetizedUrl,
          specs: o.specs,
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await fs.writeFile(path.join(apiDir, 'guides.json'), `${JSON.stringify(guides, null, 2)}\n`, 'utf8');
  if (opsReport) {
    await fs.writeFile(path.join(apiDir, 'status.json'), `${JSON.stringify(opsReport, null, 2)}\n`, 'utf8');
  }

  // RSS 2.0 feed with top 20 verified smartphone offers
  const rssItems = offers.slice(0, 20).map((o) => {
    const link = `${siteUrl}/oferta/${o.slug}/`;
    const priceStr = o.effectivePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `    <item>
      <title>${escapeXml(`${o.title} — ${priceStr} (${o.storeName})`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(o.observedAt).toUTCString()}</pubDate>
      <description>${escapeXml(`${o.analysis.verdict} Score ${o.opportunityScore}/100.`)}</description>
    </item>`;
  });

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RadarSmart BR — Ofertas Verificadas de Smartphones</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Feed automático de celulares com preço verificado em lojas nacionais e histórico anti-fraude.</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
${rssItems.join('\n')}
  </channel>
</rss>
`;

  await fs.writeFile(path.join(publicDir, 'feed.xml'), rssXml, 'utf8');
  console.log(`✅ Feeds públicos exportados: public/feed.xml (${rssItems.length} itens) e public/api/*.json`);
}

main().catch((err) => {
  console.error('❌ Erro ao exportar feeds:', err);
  process.exit(1);
});
