import fs from 'node:fs/promises';
import path from 'node:path';
import type { NormalizedOffer, PerformanceFeedbackFile, StrategyWeights } from '../src/types/domain';
import { recalibrateStrategyWeights } from '../src/engine/strategyLearner';

async function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const weightsPath = path.join(dataDir, 'strategy-weights.json');
  const feedbackPath = path.join(dataDir, 'performance-feedback.json');
  const offersPath = path.join(dataDir, 'offers.json');

  const currentWeights = JSON.parse(await fs.readFile(weightsPath, 'utf8')) as StrategyWeights;
  const feedback = JSON.parse(await fs.readFile(feedbackPath, 'utf8')) as PerformanceFeedbackFile;
  const offers = JSON.parse(await fs.readFile(offersPath, 'utf8')) as NormalizedOffer[];

  const updated = recalibrateStrategyWeights(currentWeights, feedback, offers);
  await fs.writeFile(weightsPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  console.log('✅ Pesos comerciais atualizados em data/strategy-weights.json');
  console.log(updated.notes);
}

main().catch((err) => {
  console.error('❌ Erro no learner:', err);
  process.exit(1);
});
