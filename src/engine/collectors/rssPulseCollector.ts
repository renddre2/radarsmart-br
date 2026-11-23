import type { MarketPulseItem, SourceHealthReport } from '@/types/domain';
import { fetchWithTimeout } from './vtexCollector';

const RSS_FEEDS = [
  { id: 'tudocelular', name: 'TudoCelular', url: 'https://www.tudocelular.com/feed/' },
  { id: 'canaltech', name: 'Canaltech', url: 'https://feeds.feedburner.com/canaltechbr' },
];

const SMARTPHONE_TOPIC_REGEX =
  /\b(celular|smartphone|galaxy|iphone|motorola|moto\s*[ge]|edge\s*\d|xiaomi|poco|redmi|realme|android|ios|anatel)\b/i;

export function parseRssItems(xml: string, sourceName: string): MarketPulseItem[] {
  const items: MarketPulseItem[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1];
    const title = decodeXmlText(extractTag(block, 'title'));
    const link = decodeXmlText(extractTag(block, 'link'));
    const pubDate = decodeXmlText(extractTag(block, 'pubDate'));
    const desc = decodeXmlText(extractTag(block, 'description'))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);

    if (!title || !link) continue;
    if (!SMARTPHONE_TOPIC_REGEX.test(`${title} ${desc}`)) continue;

    items.push({
      title,
      link,
      publishedAt: pubDate || new Date().toISOString(),
      source: sourceName,
      snippet: desc,
    });
    if (items.length >= 6) break;
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1').trim();
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

export async function collectMarketPulse(observedAt: string): Promise<{
  items: MarketPulseItem[];
  health: SourceHealthReport;
}> {
  const start = Date.now();
  const all: MarketPulseItem[] = [];
  const errors: string[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetchWithTimeout(feed.url, {}, 9000);
      if (!res.ok) {
        errors.push(`${feed.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      all.push(...parseRssItems(xml, feed.name));
    } catch (err) {
      errors.push(`${feed.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    items: all.slice(0, 10),
    health: {
      sourceId: 'rss-pulse',
      sourceName: 'Pulso Editorial (TudoCelular + Canaltech)',
      status: all.length > 0 ? (errors.length ? 'degraded' : 'ok') : 'error',
      latencyMs: Date.now() - start,
      rawItemsCount: all.length,
      acceptedOffersCount: all.length,
      rejectedItemsCount: 0,
      message: errors.length ? errors.join(' | ') : `${all.length} pautas recentes de smartphones capturadas.`,
      checkedAt: observedAt,
    },
  };
}
