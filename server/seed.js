const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();

/**
 * Base inicial para o app não nascer vazio: 3 áreas e 3 funcionalidades
 * com uma pergunta aprovada cada (cobrindo todos os vereditos).
 */
export function seedBase() {
  const aPCP = uid(), aFAT = uid(), aCOMP = uid();
  const areas = [
    { id: aPCP, nome: "PCP" },
    { id: aFAT, nome: "Faturamento" },
    { id: aCOMP, nome: "Compras" },
  ];
  const funcionalidades = [];
  const perguntas = [];
  const opcoes = [];

  const addFunc = (area_id, codigo, nome, d, perg) => {
    const fid = uid();
    funcionalidades.push({ id: fid, area_id, codigo, nome, ...d, criado_em: nowISO(), atualizado_em: nowISO() });
    perg.forEach((p) => {
      const pid = uid();
      perguntas.push({ id: pid, funcionalidade_id: fid, texto: p.texto, origem: "humano", status: "aprovada", motivo: "", avaliado_por: "seed", criado_em: nowISO() });
      p.opcoes.forEach((o, i) => opcoes.push({ id: uid(), pergunta_id: pid, texto: o.texto, veredito: o.veredito, ordem: i }));
    });
  };

  addFunc(aPCP, "apontamento-fabrica", "Apontamento de produção", {
    objetivo: "Registrar em tempo real o que foi produzido no chão de fábrica, por ordem e operação.",
    fluxo: "1) Operador seleciona a ordem. 2) Informa quantidade boa e refugo. 3) Registra início/fim. 4) Sistema baixa insumos e atualiza o estoque.",
    beneficio: "Visibilidade imediata da produção e cálculo automático de eficiência (OEE).",
    risco: "Sem apontamento estruturado, o custo real fica desconhecido e o planejamento vira chute.",
    limitacoes: "Integração com coletores/IoT de terceiros exige conector específico.",
    cadastrar: "Centros de trabalho, operações, roteiros e motivos de refugo.",
  }, [{
    texto: "Como a fábrica registra hoje o que foi produzido?",
    opcoes: [
      { texto: "Sistema em tempo real no chão de fábrica", veredito: "ok" },
      { texto: "Anota em papel e digita depois", veredito: "atende" },
      { texto: "Planilha compartilhada", veredito: "atende" },
      { texto: "Coletores/IoT de um fornecedor específico", veredito: "custom" },
      { texto: "Não registra de forma estruturada", veredito: "gap" },
      { texto: "Outro", veredito: "rever" },
    ],
  }]);

  addFunc(aPCP, "ordem-producao", "Ordem de produção", {
    objetivo: "Transformar a demanda em ordens de produção rastreáveis com materiais e etapas.",
    fluxo: "1) Demanda entra (pedido/previsão). 2) Explosão de materiais. 3) Geração da ordem. 4) Liberação para o chão.",
    beneficio: "Rastreabilidade completa do que produzir, quando e com quais insumos.",
    risco: "Sem ordem formal, sobra retrabalho, falta de material e prazos estourados.",
    limitacoes: "Regras de explosão muito específicas do setor podem exigir customização.",
    cadastrar: "Estrutura de produtos (BOM), roteiros e políticas de lote.",
  }, [{
    texto: "Como as ordens de produção são geradas hoje?",
    opcoes: [
      { texto: "Automático a partir do pedido de venda", veredito: "ok" },
      { texto: "Manual pelo time de PCP", veredito: "atende" },
      { texto: "Por planilha ou e-mail", veredito: "atende" },
      { texto: "Regras complexas de explosão de materiais", veredito: "custom" },
      { texto: "Não existe ordem formal", veredito: "gap" },
      { texto: "Outro", veredito: "rever" },
    ],
  }]);

  addFunc(aFAT, "emissao-nf", "Emissão de nota fiscal", {
    objetivo: "Emitir NF-e integrada ao faturamento e à apuração fiscal.",
    fluxo: "1) Fecha o pedido. 2) Calcula impostos por regra fiscal. 3) Transmite à SEFAZ. 4) Envia DANFE ao cliente.",
    beneficio: "Menos erro fiscal e conciliação automática entre venda e faturamento.",
    risco: "Emissão manual gera erro tributário, retrabalho e risco de autuação.",
    limitacoes: "Cenários fiscais muito específicos (ST, regimes especiais) podem exigir parametrização sob medida.",
    cadastrar: "Regras fiscais por UF, CFOP, natureza de operação e certificado digital.",
  }, [{
    texto: "Como as notas fiscais são emitidas hoje?",
    opcoes: [
      { texto: "ERP integrado direto à SEFAZ", veredito: "ok" },
      { texto: "Sistema separado do faturamento", veredito: "atende" },
      { texto: "Contabilidade externa emite para nós", veredito: "atende" },
      { texto: "Regras fiscais específicas do setor", veredito: "custom" },
      { texto: "Processo manual sujeito a erro", veredito: "gap" },
      { texto: "Outro", veredito: "rever" },
    ],
  }]);

  return { areas, funcionalidades, perguntas, opcoes };
}
