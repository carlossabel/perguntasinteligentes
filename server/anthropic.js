const VEREDITOS_VALIDOS = ["ok", "atende", "parceira", "parcial", "custom", "gap", "rever"];

/* Chamada única à API da Anthropic (server-side). */
async function callClaude({ prompt, model, apiKey, maxTokens = 2000 }) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function extrairJSON(texto) {
  const clean = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const json = start >= 0 ? clean.slice(start, end + 1) : clean;
  return JSON.parse(json);
}

/* ---------- Geração de FUNCIONALIDADE (cadastro técnico) ---------- */
function montarPromptFunc(tema, recusadas) {
  const contexto = recusadas && recusadas.length
    ? "\n\nNÃO repita estas perguntas já rejeitadas por um humano (com o motivo):\n" +
      recusadas.map((r) => `- "${r.texto}" (motivo: ${r.motivo || "sem motivo"})`).join("\n")
    : "";
  return `Você ajuda a cadastrar uma funcionalidade de software e montar seu diagnóstico de PROCESSO para o tema "${tema}".
Devolva dois blocos:
(1) "descricao" com: objetivo, fluxo (passos numerados em um texto), beneficio, risco (o risco de o cliente NÃO ter isso), limitacoes e cadastrar (pré-requisitos a cadastrar no sistema).
(2) "perguntas": de 2 a 3 perguntas de múltipla escolha sobre COMO a empresa faz esse processo HOJE (não sobre o sistema atual dela). No máximo 5 opções por pergunta.
Cada opção tem um veredito: "ok" (já faz bem), "atende" (dor que o software resolve padrão), "parceira" (resolve, mas via um parceiro/integração, não nativamente), "parcial" (resolve só em parte, resta um gap), "custom" (só via customização), "gap" (não atende). Sempre inclua por último a opção "Outro" com veredito "rever".${contexto}

Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:
{"descricao":{"objetivo":"","fluxo":"","beneficio":"","risco":"","limitacoes":"","cadastrar":""},"perguntas":[{"pergunta":"","opcoes":[{"texto":"","veredito":"ok|atende|custom|gap|rever"}]}]}`;
}

export async function gerarComIA({ tema, recusadas, model, apiKey }) {
  const texto = await callClaude({ prompt: montarPromptFunc(tema, recusadas), model, apiKey });
  const out = extrairJSON(texto);
  if (out.perguntas) {
    out.perguntas = out.perguntas.map((p) => ({
      pergunta: p.pergunta || p.texto || "",
      opcoes: (p.opcoes || []).map((o) => ({
        texto: o.texto || "",
        veredito: VEREDITOS_VALIDOS.includes(o.veredito) ? o.veredito : "rever",
      })),
    }));
  }
  return out;
}

/* ---------- Geração de ASSESSMENT (perguntas macro de maturidade) ---------- */
const POSTURA_PADRAO_ASSESSMENT =
  "Aja como um consultor sênior de negócios especializado em indústria. Seu objetivo é entender, de forma macro, como a empresa opera: sua dinâmica, nível de organização, processos e gargalos. Faça perguntas de alto nível que um diretor ou gerente responderia — não perguntas técnicas de sistema. Busque revelar a maturidade do negócio e onde há oportunidade de evolução.";

const BASELINE_ASSESSMENT =
  "CONTEXTO FIXO (sempre vale, não pode ser ignorado): o cliente é uma INDÚSTRIA de médio porte, com operação já estabelecida e algum nível de sistema e processo. NUNCA faça perguntas básicas, óbvias ou de empresa amadora — assuma um interlocutor experiente (diretor/gerente de operações). As perguntas devem DISTINGUIR níveis de maturidade (evite sim/não triviais), tocar em nuances reais do dia a dia industrial e ser específicas do segmento. Não invente dados do cliente; pergunte para descobrir.";

function montarPromptAssessment({ segmento, funcs, postura }) {
  const catalogo = funcs.length ? funcs.map((f) => `${f.id} — ${f.nome}`).join("\n") : "(nenhuma funcionalidade cadastrada neste segmento)";
  return `${postura || POSTURA_PADRAO_ASSESSMENT}

${BASELINE_ASSESSMENT}

TAREFA: monte um ASSESSMENT de maturidade do segmento "${segmento}", para ser aplicado por um profissional COMERCIAL. As perguntas devem entender COMO a empresa opera (visão macro de negócio), não aspectos técnicos de software.

Para CADA opção de resposta, atribua:
- "nivel": grau de maturidade de 0 (imaturo/inexistente) a 4 (maduro/otimizado).
- "oportunidades": lista de ids de funcionalidades (do catálogo abaixo) que ESSA resposta indica como oportunidade. Respostas maduras normalmente têm lista vazia []; respostas imaturas acendem oportunidades. Use SOMENTE ids exatos do catálogo. Se nenhuma se aplica, use [].

CATÁLOGO de funcionalidades disponíveis (id — nome):
${catalogo}

Gere de 4 a 6 perguntas. Cada pergunta com 3 a 5 opções, ordenadas da MAIS imatura (nivel baixo) para a MAIS madura (nivel alto).

Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:
{"perguntas":[{"pergunta":"","opcoes":[{"texto":"","nivel":0,"oportunidades":["id_do_catalogo"]}]}]}`;
}

export async function gerarAssessmentComIA({ segmento, funcs, postura, model, apiKey }) {
  const texto = await callClaude({ prompt: montarPromptAssessment({ segmento, funcs, postura }), model, apiKey, maxTokens: 2500 });
  const out = extrairJSON(texto);
  const idsValidos = new Set((funcs || []).map((f) => f.id));
  const perguntas = (out.perguntas || []).map((p) => ({
    pergunta: p.pergunta || p.texto || "",
    opcoes: (p.opcoes || []).map((o) => {
      let n = Number(o.nivel);
      if (!Number.isFinite(n)) n = 0;
      n = Math.max(0, Math.min(4, Math.round(n)));
      const oportunidades = Array.isArray(o.oportunidades) ? o.oportunidades.filter((id) => idsValidos.has(id)) : [];
      return { texto: o.texto || "", nivel: n, oportunidades };
    }),
  })).filter((p) => p.pergunta && p.opcoes.length >= 2);
  return { perguntas };
}
