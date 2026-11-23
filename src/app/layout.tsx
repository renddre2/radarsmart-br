import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getOpsReport, getSiteUrl, withBasePath } from '@/lib/dataLoader';
import './globals.css';

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'RadarSmart BR — Celulares em Oferta Real e Comparativo Verificado',
    template: '%s | RadarSmart BR',
  },
  description:
    'Radar automatizado de smartphones no Brasil com preços verificados em lojas oficiais, histórico anti-fraude, comparador técnico e consultor de compra.',
  icons: {
    icon: withBasePath('/favicon.svg'),
  },
  alternates: {
    types: {
      'application/rss+xml': withBasePath('/feed.xml'),
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ops = getOpsReport();
  const updatedLabel = ops?.executedAt
    ? new Date(ops.executedAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Agora';

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="pt-BR">
      <head>
        <meta name="color-scheme" content="light dark" />
        {gaId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        ) : null}
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 no-underline text-[var(--text-main)]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f172a] text-[#38bdf8] font-bold text-sm border border-[#38bdf8]/40">
                RS
              </span>
              <div>
                <div className="font-bold leading-tight text-base">RadarSmart BR</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Monitoramento: {updatedLabel} BRT
                </div>
              </div>
            </Link>

            <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-main)] no-underline">
                Ofertas Hoje
              </Link>
              <Link href="/comparar/" className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-main)] no-underline">
                Comparador
              </Link>
              <Link href="/guias/" className="px-3 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-main)] no-underline">
                Guias de Compra
              </Link>
              <Link href="/painel/" className="px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-main)] no-underline">
                Painel Central
              </Link>
              <a
                href={withBasePath('/feed.xml')}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border-color)] text-[var(--text-muted)] no-underline hover:text-[var(--text-main)]"
                title="Feed RSS 2.0 das ofertas"
              >
                RSS
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>

        <footer className="mt-12 border-t border-[var(--border-color)] bg-[var(--bg-card)] py-8 text-sm text-[var(--text-muted)]">
          <div className="mx-auto max-w-7xl px-4 grid gap-6 md:grid-cols-3">
            <div>
              <strong className="text-[var(--text-main)] block mb-1">RadarSmart BR</strong>
              <p className="m-0 text-xs leading-relaxed">
                Curadoria independente de smartphones com verificação direta em APIs oficiais de lojas brasileiras.
                Não vendemos nem estocamos aparelhos: redirecionamos com transparência para o checkout oficial da varejista.
              </p>
            </div>
            <div>
              <strong className="text-[var(--text-main)] block mb-1">Transparência &amp; Conformidade</strong>
              <p className="m-0 text-xs leading-relaxed">
                Links externos podem conter identificadores de afiliado (Amazon, Magalu, Mercado Livre, Shopee, Awin, Lomadee) sem custo adicional ao comprador. Preços e estoques mudam sem aviso.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <strong className="text-[var(--text-main)]">Feeds &amp; Operação</strong>
              <a href={withBasePath('/feed.xml')} className="text-[var(--color-brand)] underline">Feed RSS (/feed.xml)</a>
              <a href={withBasePath('/api/deals.json')} className="text-[var(--color-brand)] underline">API Pública JSON (/api/deals.json)</a>
              <a href={withBasePath('/api/status.json')} className="text-[var(--color-brand)] underline">Status das Fontes (/api/status.json)</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
