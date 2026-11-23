import type {
  GeneratedGuide,
  MarketPulseItem,
  NormalizedOffer,
  OfferAnalysis,
  SocialPostAsset,
} from '@/types/domain';
import { fetchWithTimeout } from './collectors/vtexCollector';

export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function generateDeterministicAnalysis(offer: NormalizedOffer): OfferAnalysis {
  const { specs, condition, effectivePrice, priceStats, storeName } = offer;
  const priceText = formatBrl(effectivePrice);
  const storageText = specs.storageGb ? `${specs.storageGb} GB` : 'armazenamento padrão';

  const idealFor =
    effectivePrice <= 1300
      ? 'Uso essencial equilibrado (WhatsApp, bancos, redes sociais e chamadas com ótima autonomia de bateria)'
      : effectivePrice <= 2400
        ? 'Custo-benefício diário (multitarefa fluida, boas fotos, pagamentos NFC e longevidade de sistema)'
        : effectivePrice <= 4000
          ? 'Usuários exigentes, criação de conteúdo móvel, jogos pesados e telas premium de alta fluidez'
          : 'Público entusiasta/profissional que busca o topo em câmeras, desempenho e anos de atualizações';

  const pros: string[] = [
    `Tela ${specs.screenSummary} aliada a ${specs.chipset}`,
    `${storageText}${specs.ramGb ? ` com ${specs.ramGb} GB de RAM` : ''} e bateria de ${specs.batteryMah ?? 5000} mAh`,
    condition === 'recondicionado'
      ? `Economia expressiva em aparelho recondicionado certificado pela ${storeName}`
      : `Vendido por varejista nacional (${storeName}) com emissão de NF-e e garantia legal`,
  ];
  if (specs.has5g && specs.hasNfc) {
    pros.push('Conectividade completa com 5G nacional e NFC para pagamentos por aproximação');
  }

  let watchout =
    condition === 'recondicionado'
      ? 'Aparelho recondicionado: verifique a classificação estética (Excelente/Muito Bom/Bom) e a política de bateria na página da loja antes de finalizar.'
      : 'Preços no varejo brasileiro oscilam por forma de pagamento (Pix vs parcelado) — compare na matriz abaixo antes do checkout.';

  if (specs.storageGb && specs.storageGb <= 128 && specs.os === 'Android') {
    watchout = `Versão de ${specs.storageGb} GB: considere 256 GB se costuma gravar muitos vídeos em 4K ou instalar jogos pesados. ${watchout}`;
  } else if (priceStats.suspiciousListPrice) {
    watchout = `Detectamos preço de tabela anterior elevado na loja; o RadarSmart filtrou o desconto real para ${priceStats.verifiedDiscountPct}% com base no histórico.`;
  }

  const verdict =
    offer.opportunityScore >= 78
      ? `Excelente janela de compra: ${specs.canonicalModel} (${storageText}) por ${priceText} atinge Score ${offer.opportunityScore}/100 (${priceStats.priceAlertLabel}).`
      : `Opção sólida verificada em ${storeName}: ${specs.canonicalModel} (${storageText}) sai a ${priceText} com ${priceStats.priceAlertLabel.toLowerCase()}.`;

  const faqs = [
    {
      question: `O ${specs.canonicalModel} vendido na ${storeName} é original e homologado pela Anatel?`,
      answer: `Sim. A oferta é coletada diretamente do catálogo oficial da ${storeName} no Brasil (${condition === 'recondicionado' ? 'aparelho seminovo/recondicionado revisado com garantia legal' : 'produto nacional com nota fiscal e garantia do fabricante/varejista conforme CDC'}).`,
    },
    {
      question: `O preço de ${priceText} já está atualizado e pode mudar?`,
      answer: `O valor ${priceText} foi verificado no snapshot mais recente do RadarSmart BR (${offer.observedAt.slice(0, 16).replace('T', ' ')} UTC). Lojas alteram estoques e condições Pix/parcelado sem aviso prévio; sempre confira o valor final no carrinho.`,
    },
    {
      question: `Este modelo tem 5G e NFC para pagamento por aproximação?`,
      answer: `${specs.has5g ? 'Sim, possui suporte a redes 5G.' : 'Este modelo específico opera em 4G/LTE.'} ${specs.hasNfc ? 'Conta com NFC compatível com carteiras digitais (Google Wallet / Apple Pay).' : 'Não possui NFC confirmado nesta ficha; confira as especificações da loja caso use pagamento por aproximação.'}`,
    },
    {
      question: `Vale a pena comprar agora ou esperar baixar mais?`,
      answer:
        priceStats.observationsCount >= 2
          ? `No nosso histórico, o menor valor observado foi ${formatBrl(priceStats.minObservedPrice)} e a média é ${formatBrl(priceStats.avgObservedPrice)}. ${effectivePrice <= priceStats.minObservedPrice * 1.03 ? 'O preço atual está praticamente no piso histórico.' : 'Considere comparar na matriz de lojas parceiras antes de fechar.'}`
          : `Primeira janela registrada neste ciclo a ${priceText}. Recomendamos checar os links comparativos (Amazon, Magalu, Mercado Livre e Shopee) nesta página antes de finalizar.`,
    },
  ];

  return {
    verdict,
    idealFor,
    pros: pros.slice(0, 4),
    watchout,
    faqs,
  };
}

export function passesFactGuard(text: string, offer: NormalizedOffer): boolean {
  if (!text || text.trim().length < 25) return false;
  // Every R$ price mentioned in LLM output must match the offer's real price or listPrice within R$ 2 tolerance
  const matches = text.matchAll(/R\$\s*([\d.]+(?:,\d{2})?)/g);
  for (const m of matches) {
    const numeric = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return false;
    const matchesEffective = Math.abs(numeric - offer.effectivePrice) <= 2;
    const matchesList = Math.abs(numeric - offer.listPrice) <= 2;
    const matchesCash = Math.abs(numeric - offer.price) <= 2;
    if (!matchesEffective && !matchesList && !matchesCash) {
      return false;
    }
  }
  return true;
}

async function tryFreeLlmHook(
  offer: NormalizedOffer,
  siteBaseUrl: string,
): Promise<{ text: string; provider: SocialPostAsset['generatedBy'] } | null> {
  const ghToken = (process.env.GITHUB_MODELS_TOKEN ?? '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY ?? '').trim();

  const prompt = [
    'Escreva uma chamada curta e honesta em português do Brasil (máximo 220 caracteres) para um canal de ofertas de celulares no Telegram.',
    `Produto: ${offer.title}`,
    `Preço verificado: ${formatBrl(offer.effectivePrice)}`,
    `Loja: ${offer.storeName} (${offer.condition})`,
    `Destaques: ${offer.specs.screenSummary}, ${offer.specs.cameraSummary}, 5G=${offer.specs.has5g ? 'Sim' : 'Não'}`,
    'Regras: NÃO invente cupons, NÃO prometa estoque infinito, cite exatamente o preço informado ou nenhum preço.',
  ].join('\n');

  if (ghToken) {
    try {
      const res = await fetchWithTimeout(
        'https://models.github.ai/inference/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ghToken}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 120,
            temperature: 0.4,
          }),
        },
        9000,
      );
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = json.choices?.[0]?.message?.content?.trim() ?? '';
        if (passesFactGuard(content, offer)) {
          return { text: content, provider: 'github-models' };
        }
      }
    } catch {
      // Fallback silently to deterministic generator
    }
  }

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 120, temperature: 0.4 },
          }),
        },
        9000,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
        if (passesFactGuard(content, offer)) {
          return { text: content, provider: 'gemini-free' };
        }
      }
    } catch {
      // Fallback silently
    }
  }

  void siteBaseUrl;
  return null;
}

export async function generateSocialQueue(
  topOffers: NormalizedOffer[],
  siteBaseUrl: string,
): Promise<{ queue: SocialPostAsset[]; llmStatus: string }> {
  const queue: SocialPostAsset[] = [];
  let llmUsedCount = 0;
  let llmProviderName = 'determinístico (Fact-Guard 100% ativo)';

  for (let i = 0; i < Math.min(topOffers.length, 8); i++) {
    const offer = topOffers[i];
    const priceText = formatBrl(offer.effectivePrice);
    const dealPath = `${siteBaseUrl.replace(/\/$/, '')}/oferta/${offer.slug}/`;
    const conditionTag = offer.condition === 'recondicionado' ? '♻️ Recondicionado Certificado' : '📦 Novo • Loja Oficial';

    let hook = `${offer.analysis.verdict}`;
    let generatedBy: SocialPostAsset['generatedBy'] = 'deterministic';

    // Try free LLM enrichment only on top 3 offers when token exists
    if (i < 3 && (process.env.GITHUB_MODELS_TOKEN || process.env.GEMINI_API_KEY)) {
      const llm = await tryFreeLlmHook(offer, siteBaseUrl);
      if (llm) {
        hook = llm.text;
        generatedBy = llm.provider;
        llmUsedCount += 1;
        llmProviderName = llm.provider;
      }
    }

    const discountLine =
      offer.priceStats.verifiedDiscountPct >= 5
        ? `📉 Desconto verificado: <b>${offer.priceStats.verifiedDiscountPct}%</b> (${offer.priceStats.priceAlertLabel})`
        : `📊 Status: ${offer.priceStats.priceAlertLabel}`;

    const telegramHtml = [
      `📱 <b>${escapeHtml(offer.title)}</b>`,
      `${conditionTag} • <b>${escapeHtml(offer.storeName)}</b>`,
      ``,
      `💰 <b>${escapeHtml(priceText)}</b>`,
      discountLine,
      `⭐ Score RadarSmart: <b>${offer.opportunityScore}/100</b>`,
      ``,
      `🔎 ${escapeHtml(hook)}`,
      ``,
      `👉 <a href="${dealPath}">Ver ficha, histórico e comparar lojas</a>`,
      `<i>#publi • Preço verificado em loja oficial; sujeito a alteração sem aviso.</i>`,
    ].join('\n');

    const whatsappText = [
      `📱 *${offer.title}*`,
      `${conditionTag} | *${offer.storeName}*`,
      `💰 *${priceText}* (Score ${offer.opportunityScore}/100)`,
      offer.priceStats.verifiedDiscountPct >= 5 ? `📉 ${offer.priceStats.verifiedDiscountPct}% abaixo da referência` : '',
      ``,
      `${hook}`,
      `👉 Comparar preços e ir para oferta: ${dealPath}`,
      `_Divulgação de afiliado • Preço sujeito a alteração na loja._`,
    ]
      .filter(Boolean)
      .join('\n');

    const shortVideoScript = [
      `[00-04s GANCHO] Se você quer um celular ${offer.brand} sem pagar caro, olha esse achado de hoje por ${priceText}.`,
      `[04-14s ESPECIFICAÇÕES] É o ${offer.specs.canonicalModel}${offer.specs.storageGb ? ` de ${offer.specs.storageGb} GB` : ''}, com tela ${offer.specs.screenSummary}, bateria de ${offer.specs.batteryMah ?? 5000} mAh e ${offer.specs.has5g ? '5G + NFC' : 'câmera de ' + offer.specs.cameraSummary}.`,
      `[14-26s VEREDICTO] No nosso radar ele bateu ${offer.opportunityScore} de 100 pontos porque está em loja nacional verificada (${offer.storeName})${offer.condition === 'recondicionado' ? ' na linha recondicionada com garantia' : ' com nota fiscal'}.`,
      `[26-34s CTA] O link comparando ${offer.storeName}, Amazon, Magalu e Mercado Livre tá na bio/descrição — confere antes de acabar o estoque!`,
    ].join('\n');

    const instagramCaption = [
      `🔥 ${offer.specs.canonicalModel} por ${priceText} na ${offer.storeName}!`,
      ``,
      `✅ ${offer.analysis.pros[0] ?? offer.specs.screenSummary}`,
      `✅ ${offer.analysis.pros[1] ?? offer.specs.cameraSummary}`,
      `⚠️ Ponto de atenção: ${offer.analysis.watchout}`,
      ``,
      `🔗 Link verificado e comparativo completo no portal RadarSmart BR (${dealPath}).`,
      `#celular #smartphone #ofertasdecelular #${offer.brand.toLowerCase()} #custobeneficio #publi`,
    ].join('\n');

    queue.push({
      offerId: offer.id,
      slug: offer.slug,
      title: offer.title,
      opportunityScore: offer.opportunityScore,
      price: offer.effectivePrice,
      storeName: offer.storeName,
      telegramHtml,
      whatsappText,
      shortVideoScript,
      instagramCaption,
      generatedBy,
    });
  }

  return {
    queue,
    llmStatus: llmUsedCount > 0 ? `${llmProviderName} (${llmUsedCount} chamadas validadas pelo Fact-Guard)` : llmProviderName,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function generateSeoGuides(
  activeOffers: NormalizedOffer[],
  pulseItems: MarketPulseItem[],
  nowIso: string,
): GeneratedGuide[] {
  const newPhones = activeOffers.filter((o) => o.condition === 'novo');
  const refurbPhones = activeOffers.filter((o) => o.condition === 'recondicionado');

  const topBudget = [...newPhones]
    .filter((o) => o.effectivePrice <= 1550)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const topMidrange = [...newPhones]
    .filter((o) => o.effectivePrice > 1550 && o.effectivePrice <= 2800)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const topMotorola = [...newPhones]
    .filter((o) => o.brand === 'Motorola')
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const topSamsung = [...newPhones]
    .filter((o) => o.brand === 'Samsung')
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const topApple = [...activeOffers]
    .filter((o) => o.brand === 'Apple')
    .sort((a, b) => a.effectivePrice - b.effectivePrice)
    .slice(0, 5);

  const topDiscounts = [...activeOffers]
    .sort((a, b) => b.priceStats.verifiedDiscountPct - a.priceStats.verifiedDiscountPct || b.opportunityScore - a.opportunityScore)
    .slice(0, 6);

  const recentHeadline = pulseItems[0]?.title
    ? `Contexto recente do mercado: "${pulseItems[0].title}" (${pulseItems[0].source}).`
    : 'Todos os preços listados refletem consultas diretas em estoques nacionais.';

  const pickListLines = (list: NormalizedOffer[]) =>
    list.map(
      (o) =>
        `${o.title} — ${formatBrl(o.effectivePrice)} (${o.storeName}, Score ${o.opportunityScore}/100${o.condition === 'recondicionado' ? ', Recondicionado' : ''})`,
    );

  const guides: GeneratedGuide[] = [
    {
      slug: 'melhor-celular-custo-beneficio-ate-1500',
      title: 'Melhor Celular Custo-Benefício até R$ 1.500 (Verificado Hoje)',
      seoDescription: 'Ranking atualizado automaticamente com smartphones novos até R$ 1.500 em lojas nacionais confiáveis, sem acessórios escondidos.',
      targetQuery: 'melhor celular ate 1500 custo beneficio 2026',
      updatedAt: nowIso,
      summary: `Selecionamos os modelos novos até R$ 1.550 com melhor equilíbrio de tela, bateria de longa duração e disponibilidade real em estoque. ${recentHeadline}`,
      methodologyNote: 'Critério: apenas aparelhos em estoque nacional (AvailableQuantity > 0), filtragem anti-acessórios e análise de desconto real.',
      recommendedOfferIds: (topBudget.length ? topBudget : newPhones.slice(0, 4)).map((o) => o.id),
      sections: [
        {
          heading: 'Destaques Verificados em Estoque',
          body: 'Nesta faixa de entrada/intermediário econômico, priorizamos ao menos 128 GB de armazenamento e telas com boa fluidez para evitar travamentos precoces.',
          bulletPoints: pickListLines(topBudget.length ? topBudget : newPhones.slice(0, 4)),
        },
        {
          heading: 'O que evitar abaixo de R$ 1.500',
          body: 'Evite modelos com menos de 4 GB de RAM ou apenas 64 GB de armazenamento. Sempre confira se há NFC caso utilize cartão por aproximação no celular.',
          bulletPoints: [
            'Priorize 128 GB ou mais para atualizações futuras do Android.',
            'Compare a loja oficial com Amazon, Magalu e Mercado Livre antes de pagar.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Celular até R$ 1.500 roda aplicativos de banco e jogos leves?',
          answer: 'Sim. Aparelhos atuais com 4 GB a 8 GB de RAM e 128 GB rodam WhatsApp, bancos, Uber e jogos populares sem dificuldades.',
        },
      ],
    },
    {
      slug: 'melhor-celular-intermediario-5g-ate-2800',
      title: 'Melhores Celulares Intermediários 5G entre R$ 1.500 e R$ 2.800',
      seoDescription: 'Comparativo vivo de celulares 5G com câmera OIS, NFC e telas AMOLED/pOLED até R$ 2.800 em varejistas oficiais.',
      targetQuery: 'melhor celular intermediario 5g 2026',
      updatedAt: nowIso,
      summary: 'A faixa mais competitiva do Brasil reúne aparelhos com proteção contra água (IP67/IP68), estabilização óptica e anos de suporte oficial.',
      methodologyNote: 'Pontuação pondera hardware (chipset, 5G, NFC, tela 120Hz) contra preço efetivo em estoque.',
      recommendedOfferIds: (topMidrange.length ? topMidrange : newPhones.slice(0, 4)).map((o) => o.id),
      sections: [
        {
          heading: 'Modelos Intermediários em Destaque',
          body: 'Os aparelhos abaixo entregam a melhor relação entre longevidade e preço hoje no radar:',
          bulletPoints: pickListLines(topMidrange.length ? topMidrange : newPhones.slice(0, 4)),
        },
      ],
      faqs: [
        {
          question: 'Vale pagar mais por um intermediário com 256 GB e 5G?',
          answer: 'Sim, especialmente se você pretende ficar com o aparelho por 3 anos ou mais. 256 GB evita falta de espaço com fotos e vídeos.',
        },
      ],
    },
    {
      slug: 'melhores-celulares-samsung-galaxy-em-oferta',
      title: 'Melhores Celulares Samsung Galaxy em Oferta Hoje',
      seoDescription: 'Monitoramento contínuo da linha Galaxy A e Galaxy S em lojas nacionais verificadas, com histórico de preço e comparador.',
      targetQuery: 'celular samsung galaxy em oferta hoje',
      updatedAt: nowIso,
      summary: 'Da linha Galaxy A ao ecossistema Galaxy S com IA integrada: veja quais modelos Samsung estão realmente com bom preço hoje.',
      methodologyNote: 'Inclui verificação automática contra falsos descontos ("metade do dobro").',
      recommendedOfferIds: (topSamsung.length ? topSamsung : activeOffers.slice(0, 4)).map((o) => o.id),
      sections: [
        {
          heading: 'Seleção Samsung Verificada',
          body: 'Modelos Samsung com melhor Score RadarSmart no ciclo atual:',
          bulletPoints: pickListLines(topSamsung.length ? topSamsung : activeOffers.slice(0, 4)),
        },
      ],
      faqs: [
        {
          question: 'Quantos anos de atualização a Samsung oferece na linha Galaxy A e S?',
          answer: 'Modelos recentes como Galaxy A56/A36 e a família Galaxy S oferecem múltiplos anos de atualizações de Android e segurança (4 a 7 gerações dependendo do modelo).',
        },
      ],
    },
    {
      slug: 'melhores-celulares-motorola-edge-e-moto-g',
      title: 'Motorola Edge e Moto G: Quais Realmente Valem a Pena?',
      seoDescription: 'Preços oficiais diretos da Motorola Brasil e grandes redes, comparando Edge e Moto G com análise técnica objetiva.',
      targetQuery: 'melhor motorola custo beneficio moto g edge',
      updatedAt: nowIso,
      summary: 'Acompanhamos o catálogo oficial da Motorola Brasil em tempo real para identificar quedas na linha Moto G e nos kits Motorola Edge.',
      methodologyNote: 'Dados consultados diretamente na loja oficial Motorola e varejistas nacionais.',
      recommendedOfferIds: (topMotorola.length ? topMotorola : newPhones.slice(0, 4)).map((o) => o.id),
      sections: [
        {
          heading: 'Destaques Motorola no Radar',
          body: 'Modelos e kits com melhor custo-benefício disponível agora:',
          bulletPoints: pickListLines(topMotorola.length ? topMotorola : newPhones.slice(0, 4)),
        },
      ],
      faqs: [
        {
          question: 'Kits Motorola com Moto Buds valem a pena?',
          answer: 'Sim quando o preço do kit fica próximo ou abaixo do aparelho avulso. Sinalizamos kits claramente nos cards.',
        },
      ],
    },
    {
      slug: 'iphone-mais-barato-novo-vs-recondicionado',
      title: 'iPhone Mais Barato para Comprar em 2026: Novo vs Recondicionado',
      seoDescription: 'Guia transparente comparando iPhones novos lacrados e recondicionados certificados com garantia no Brasil.',
      targetQuery: 'iphone mais barato vale a pena recondicionado trocafone',
      updatedAt: nowIso,
      summary: 'Comparamos opções novas e recondicionadas certificadas separando claramente cada condição para você decidir com segurança.',
      methodologyNote: 'Aparelhos recondicionados exibem rótulo destacado e garantia legal de 90 dias.',
      recommendedOfferIds: (topApple.length ? topApple : refurbPhones.slice(0, 4)).map((o) => o.id),
      sections: [
        {
          heading: 'Opções Apple Monitoradas Agora',
          body: 'Confira iPhones disponíveis em estoque verificando sempre a etiqueta de condição (Novo vs Recondicionado):',
          bulletPoints: pickListLines(topApple.length ? topApple : refurbPhones.slice(0, 4)),
        },
      ],
      faqs: [
        {
          question: 'Comprar iPhone recondicionado na Trocafone é seguro?',
          answer: 'A Trocafone realiza testes funcionais e oferece garantia legal, sendo importante ler a classificação estética (Excelente/Muito Bom/Bom) antes da compra.',
        },
      ],
    },
    {
      slug: 'maiores-descontos-reais-celulares-hoje',
      title: 'Maiores Descontos Reais de Smartphones Auditados Hoje',
      seoDescription: 'Lista ranqueada pelo percentual real de desconto verificado contra histórico de preços, filtrando promoções maquiadas.',
      targetQuery: 'promocao celular hoje desconto real verificado',
      updatedAt: nowIso,
      summary: 'Este ranking pune preços de lista inflados artificialmente e prioriza ofertas com redução real confirmada em varejistas oficiais.',
      methodologyNote: 'Algoritmo anti-"metade do dobro" compara preço atual, tabela e histórico diário.',
      recommendedOfferIds: topDiscounts.map((o) => o.id),
      sections: [
        {
          heading: 'Top Ofertas Auditadas no Ciclo Atual',
          body: 'As oportunidades com maior combinação de desconto real e nota técnica:',
          bulletPoints: pickListLines(topDiscounts),
        },
      ],
      faqs: [
        {
          question: 'Como o RadarSmart evita promoções falsas?',
          answer: 'Quando uma loja declara um "preço de lista" mais de 75% acima do valor cobrado sem histórico que sustente esse patamar, nosso motor marca o preço de lista como suspeito e recalcula o desconto sobre a média observada.',
        },
      ],
    },
  ];

  return guides;
}
