import type { Metadata } from 'next';
import {
  getContentQueue,
  getOpsReport,
  getPublishedLedger,
  getSiteUrl,
  getStrategyWeights,
} from '@/lib/dataLoader';
import { DashboardClient } from '@/components/DashboardClient';

export const metadata: Metadata = {
  title: 'Painel Central de Operações & Afiliados',
  description:
    'Monitoramento de fontes, cadastros CPF pendentes, fila de conteúdo pronto para Telegram/WhatsApp/Shorts e métricas do RadarSmart BR.',
  robots: { index: false, follow: false },
};

export default function ControlDashboardPage() {
  const ops = getOpsReport();
  const queue = getContentQueue();
  const ledger = getPublishedLedger();
  const weights = getStrategyWeights();
  const siteUrl = getSiteUrl();

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card p-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold m-0">Painel Central — RadarSmart BR</h1>
        <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
          Acompanhe a saúde das APIs, copie conteúdos prontos para divulgação e conclua a ativação dos programas de afiliados em CPF.
        </p>
      </div>
      <DashboardClient
        ops={ops}
        queue={queue}
        ledger={ledger}
        weights={weights}
        siteUrl={siteUrl}
      />
    </div>
  );
}
