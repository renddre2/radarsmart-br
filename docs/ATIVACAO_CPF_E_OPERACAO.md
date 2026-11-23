# Guia de Ativação em CPF & Operação Contínua — RadarSmart BR

## 1. Ativar Execução Automática na Nuvem (a cada 6h, sem depender do PC)
O workflow agendado já está pronto em `config/workflows/autonomous-radar.yml`. Como o token atual do GitHub CLI (`gh`) não possui o escopo `workflow`, execute uma única vez no terminal:

```powershell
gh auth refresh -h github.com -s workflow
npm.cmd run activate-cloud
```

Isso habilita o cron automático (`cron: '17 */6 * * *'`) e a publicação automática via GitHub Actions. Enquanto preferir atualizar manualmente, rode `npm.cmd run pipeline` seguido de `npm.cmd run deploy:pages`.

## 2. O que você precisa fazer nos Programas de Afiliados (custo R$ 0,00 — exige apenas CPF)
O portal já está publicado e pronto para ser informado nos cadastros abaixo. Apenas os cadastros jurídicos/financeiros exigem seu consentimento pessoal:

1. **Amazon Associados Brasil** (`https://associados.amazon.com.br/`)
   - Informe como site: `https://renddre2.github.io/radarsmart-br/`
   - Pegue sua tag (ex.: `radarsmart-20`) e salve em `AMAZON_PARTNER_TAG`.
2. **Influenciador Magalu** (`https://www.parceiromagalu.com.br/`)
   - Cadastro com CPF + PIS/NIT + conta bancária no mesmo CPF. Saque mínimo: R$ 50 (pagamentos dias 4 e 19).
   - Salve o nome da sua vitrine em `MAGALU_STORE_SLUG`.
3. **Afiliados Mercado Livre** (`https://www.mercadolivre.com.br/l/afiliados`)
   - Cadastro com CPF + conta Mercado Pago no mesmo CPF. Saque mínimo: R$ 30.
   - Informe o site publicado acima e mapeie seus links `/sec/...` na variável `ML_AFFILIATE_MAP_JSON`.
4. **Shopee Afiliados + Open API** (`https://affiliate.shopee.com.br/`)
   - Aceita CPF. Ao liberar a **Open API**, salve `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` — o motor GraphQL SHA-256 começa a coletar ofertas Shopee automaticamente!
5. **Awin Brasil** (`https://www.awin.com/br/afiliados`) e **Lomadee** (`https://www.lomadee.com/`)
   - Aceitam CPF. Na Awin, solicite filiação aos anunciantes **Motorola Brasil**, **Fast Shop**, **Trocafone** e **KaBuM!** e configure `AWIN_AFFILIATE_ID` + os IDs `AWIN_MID_*`.
6. **Canal Automático no Telegram (Opcional, R$ 0)**
   - Crie um canal público no Telegram (ex.: `@radarsmartbr_ofertas`).
   - Converse com `@BotFather`, crie um bot (`/newbot`), adicione o bot como administrador do canal.
   - Execute `npm.cmd run configure` para gravar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` com segurança no GitHub.

## 3. Notas Fiscais, Tributação (CPF) e Evolução para CNPJ
- Você **não compra estoque, não emite NF-e de mercadoria e não faz entrega** — quem vende e garante é a loja oficial (Motorola, Fast Shop, Amazon, Magalu, etc.).
- Rendimentos de afiliado recebidos em CPF devem respeitar a tabela progressiva de IRPF (Carnê-Leão quando ultrapassar a faixa de isenção mensal). No Magalu há retenção automática de INSS (11%) para autônomos.
- Quando as comissões mensais crescerem de forma consistente, avalie com contador abrir CNPJ (ME) para reduzir a alíquota efetiva de imposto e negociar comissões maiores.
