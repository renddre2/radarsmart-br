import { runAutonomousPipeline } from '../src/engine/runPipeline';

async function main() {
  console.log('🚀 Iniciando pipeline autônomo RadarSmart BR...');
  const result = await runAutonomousPipeline(process.cwd());
  console.log(`✅ Pipeline concluído em ${result.opsReport.durationMs}ms`);
  console.log(`📱 Ofertas ativas: ${result.opsReport.activeOffersCount} | Expiradas: ${result.opsReport.expiredOffersCount}`);
  console.log(`📚 Guias SEO: ${result.opsReport.guidesCount} | Fila multicanal: ${result.opsReport.queuedPostsCount}`);
  if (result.topOffer) {
    console.log(
      `🏆 Oferta #1: ${result.topOffer.title} | R$ ${result.topOffer.effectivePrice.toFixed(2)} | ${result.topOffer.storeName} | Score ${result.topOffer.opportunityScore}/100`,
    );
  }
  console.log('📡 Saúde das fontes:');
  for (const s of result.opsReport.sources) {
    console.log(`   - ${s.sourceName}: [${s.status}] ${s.acceptedOffersCount} ofertas (${s.latencyMs}ms) — ${s.message}`);
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal no pipeline:', err);
  process.exit(1);
});
