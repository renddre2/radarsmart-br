import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const VARIABLE_KEYS = [
  { key: 'MAGALU_STORE_SLUG', prompt: 'Slug da loja Parceiro/Influenciador Magalu (ex: seunome) [Enter p/ pular]: ' },
  { key: 'AMAZON_PARTNER_TAG', prompt: 'Tag Amazon Associados Brasil (ex: seuid-20) [Enter p/ pular]: ' },
  { key: 'SHOPEE_AFFILIATE_ID', prompt: 'ID de Afiliado Shopee (af_siteid) [Enter p/ pular]: ' },
  { key: 'SHOPEE_APP_ID', prompt: 'Shopee Open API AppId [Enter p/ pular]: ' },
  { key: 'AWIN_AFFILIATE_ID', prompt: 'ID Publisher Awin (awinaffid) [Enter p/ pular]: ' },
  { key: 'LOMADEE_SOURCE_ID', prompt: 'SourceId Lomadee [Enter p/ pular]: ' },
  { key: 'TELEGRAM_CHAT_ID', prompt: 'Chat ID ou @canal do Telegram [Enter p/ pular]: ' },
];

const SECRET_KEYS = [
  { key: 'SHOPEE_APP_SECRET', prompt: 'Shopee Open API Secret (será salvo como GitHub Secret) [Enter p/ pular]: ' },
  { key: 'TELEGRAM_BOT_TOKEN', prompt: 'Telegram Bot Token do @BotFather (GitHub Secret) [Enter p/ pular]: ' },
  { key: 'GEMINI_API_KEY', prompt: 'Google Gemini API Key gratuita (opcional, GitHub Secret) [Enter p/ pular]: ' },
];

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log('🔐 Assistente de Configuração de Afiliados CPF — RadarSmart BR');
  console.log('Este script NÃO grava segredos no código: envia diretamente para GitHub Variables/Secrets via CLI `gh`.\n');

  const repo = (await rl.question('Repositório GitHub (padrão: renddre2/radarsmart-br): ')).trim() || 'renddre2/radarsmart-br';

  for (const item of VARIABLE_KEYS) {
    const val = (await rl.question(item.prompt)).trim();
    if (val) {
      execFileSync('gh', ['variable', 'set', item.key, '--repo', repo, '--body', val], { stdio: 'inherit' });
    }
  }

  for (const item of SECRET_KEYS) {
    const val = (await rl.question(item.prompt)).trim();
    if (val) {
      execFileSync('gh', ['secret', 'set', item.key, '--repo', repo, '--body', val], { stdio: 'inherit' });
    }
  }

  rl.close();
  console.log('\n✅ Configuração sincronizada com segurança! Rode o workflow no GitHub Actions para aplicar imediatamente.');
}

main().catch((err) => {
  console.error('❌ Erro ao configurar afiliados:', err);
  process.exit(1);
});
