# RadarSmart BR — Arquitetura, Estado Operacional e Regras do Projeto

## Visão Geral
**RadarSmart BR** (`radarsmart-br`) é um portal autônomo de curadoria técnica, comparação de preços e radar de ofertas verificadas de smartphones no Brasil, projetado para operar com **custo R$ 0,00** e compatibilidade integral com **Pessoa Física (CPF)** via programas de afiliados oficiais (Magalu, Amazon Associados, Mercado Livre, Shopee, Awin e Lomadee).

> **Decisão Estratégica de Compliance:** Dropshipping nacional sem estoque via CPF foi descartado por inviabilidade fiscal e regulatória (exigência de NF-e/IE, homologação Anatel, garantia legal CDC de 90 dias e riscos tributários). Todo checkout ocorre exclusivamente nos sites oficiais dos varejistas parceiros.

## Stack & Infraestrutura (R$ 0,00)
- **Framework:** Next.js (Static Export `output: 'export'`), React 19, TypeScript, Tailwind CSS v4.
- **Motor Autônomo (`src/engine/`):** Coleta paralela de catálogos públicos VTEX (`Motorola Oficial`, `Fast Shop`, `Trocafone`, `Bemol`, `Angeloni Eletro`, `Fujioka`), conector oficial Shopee Affiliate Open API (GraphQL + SHA-256), pulso RSS (`TudoCelular`, `Canaltech`), histórico de preços anti-"metade do dobro", scorer ponderado, gerador de guias SEO/conteúdo multicanal com Fact-Guard, e publicador Telegram/Webhook com ledger idempotente.
- **Persistência Git-Native (`data/`):** Snapshots JSON auditáveis versionados no repositório.
- **Hospedagem & Automação Cloud:** GitHub Pages + GitHub Actions (`cron: '17 */6 * * *'`). Não depende do computador local ligado.

## Comandos Principais (Windows: usar `npm.cmd`)
- `npm.cmd run pipeline` — Executa varredura real, histórico, score, guias, fila multicanal e relatório operacional.
- `npm.cmd run learn` — Recalibra pesos comerciais em `data/strategy-weights.json` a partir de `data/performance-feedback.json`.
- `npm.cmd run configure` — Verifica ou sincroniza variáveis/secrets de afiliados com o GitHub Actions (`gh`).
- `npm.cmd run deploy:pages` — Compila exportação estática para `/radarsmart-br` e publica na branch `gh-pages`.
- `npm.cmd run activate-cloud` — Instala `.github/workflows/autonomous-radar.yml` na `main` e ativa cron 6h no GitHub Actions (requer `gh auth refresh -h github.com -s workflow`).
- `npm.cmd test` — Executa suíte automatizada Vitest (`tests/`).
- `npm.cmd run typecheck` — Valida tipagem TypeScript (`tsc --noEmit`).
- `npm.cmd run build` — Gera feeds públicos (`public/feed.xml`, `public/api/*.json`) e compila exportação estática em `out/`.

## Regras Inegociáveis
1. **Zero credenciais versionadas:** Tokens/chaves ficam exclusivamente em GitHub Secrets/Variables ou `.env.local` (ignorado no `.gitignore`).
2. **Transparência obrigatória:** Recondicionados (ex.: Trocafone) são explicitamente rotulados; ofertas esgotadas transitam para `expired` com redirecionamento para equivalente ativo.
3. **Sem promessas não verificadas:** Preços exibidos refletem o último snapshot verificado com timestamp visível e proteção contra falsos descontos.

## Registro de Progresso
- **Status atual:** Portal publicado e verificado em produção (`HTTP 200`) no GitHub Pages (`renddre2/radarsmart-br`, branch `gh-pages`), com 79 ofertas reais verificadas, 6 guias SEO, 12 testes Vitest aprovados e `tsc --noEmit` limpo.
- **URL Pública Ativa:** `https://renddre2.github.io/radarsmart-br/`
- **Painel Central:** `https://renddre2.github.io/radarsmart-br/painel/`
- **Comparador:** `https://renddre2.github.io/radarsmart-br/comparar/`
- **Guias SEO:** `https://renddre2.github.io/radarsmart-br/guias/`
- **Feeds Públicos:** `/feed.xml`, `/api/deals.json`, `/api/guides.json`, `/api/status.json`, `/sitemap.xml`
- **Pendente de ação do titular:**
  1. Autorizar escopo `workflow` no `gh` (`gh auth refresh -h github.com -s workflow`) e rodar `npm.cmd run activate-cloud` para ligar o cron de 6h em `.github/workflows/autonomous-radar.yml` (template pronto em `config/workflows/autonomous-radar.yml`).
  2. Concluir cadastros pessoais em CPF (Amazon, Magalu, Mercado Livre, Shopee, Awin, Lomadee) e executar `npm.cmd run configure`.
