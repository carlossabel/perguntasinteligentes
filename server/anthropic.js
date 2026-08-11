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
(1) "como_atende": um texto curto (1 a 3 frases) descrevendo COMO o sistema atende/cobre esse processo. Será mostrado no relatório apenas quando a resposta do cliente indicar que o sistema já atende.
(2) "perguntas": de 2 a 3 perguntas de múltipla escolha sobre COMO a empresa faz esse processo HOJE (não sobre o sistema atual dela). No máximo 5 opções por pergunta.
Cada opção tem um veredito: "ok" (já faz bem), "atende" (dor que o software resolve padrão), "parceira" (resolve, mas via um parceiro/integração, não nativamente), "parcial" (resolve só em parte, resta um gap), "custom" (só via customização), "gap" (não atende). Sempre inclua por último a opção "Outro" com veredito "rever".${contexto}

Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:
{"como_atende":"","perguntas":[{"pergunta":"","opcoes":[{"texto":"","veredito":"ok|atende|custom|gap|rever"}]}]}`;
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

/* ---------- Geração do QUESTIONÁRIO INICIAL do segmento (consultor sênior de indústria) ---------- */
const NIVEIS_VALIDOS = [0, 1, 2, 3, 4];
function montarPromptAssessment(segmento, funcs) {
  const listaFuncs = funcs && funcs.length ? funcs.map((f) => `- ${f}`).join("\n") : "(nenhuma cadastrada ainda)";
  return `Você é um consultor SÊNIOR de ERP para INDÚSTRIA. Monte o QUESTIONÁRIO INICIAL (macro) de diagnóstico para o segmento "${segmento}".
Comporte-se como um consultor sênior levantando COMO a indústria trabalha HOJE, percorrendo as principais áreas de uma indústria: comercial/vendas, engenharia/produto, PCP/planejamento, produção/chão de fábrica, estoque/almoxarifado, compras/suprimentos, expedição/logística, qualidade, manutenção, custos, fiscal, financeiro, contábil e RH.
Gere de 6 a 10 perguntas de múltipla escolha sobre COMO a empresa faz HOJE (não sobre o software atual dela). Cada pergunta com 3 a 5 opções, ordenadas do MENOS maduro para o MAIS maduro.
Cada opção tem um "nivel" de maturidade de 0 a 4 (0 = manual/imaturo; 4 = maduro, automatizado e integrado).
Quando fizer sentido, preencha "acende" com os NOMES de funcionalidades (exatamente como aparecem na lista abaixo) que aquela resposta sinaliza como oportunidade. Use SOMENTE nomes desta lista; se nenhum se aplicar, use [].
Funcionalidades cadastradas:
${listaFuncs}

Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:
{"perguntas":[{"pergunta":"","opcoes":[{"texto":"","nivel":0,"acende":[""]}]}]}`;
}

export async function gerarAssessmentComIA({ segmento, funcs, model, apiKey }) {
  const texto = await callClaude({ prompt: montarPromptAssessment(segmento, funcs), model, apiKey, maxTokens: 3500 });
  const out = extrairJSON(texto);
  const perguntas = Array.isArray(out.perguntas) ? out.perguntas : [];
  return {
    perguntas: perguntas.map((p) => ({
      pergunta: p.pergunta || p.texto || "",
      opcoes: (p.opcoes || []).map((o) => ({
        texto: o.texto || "",
        nivel: NIVEIS_VALIDOS.includes(Number(o.nivel)) ? Number(o.nivel) : 2,
        acende: Array.isArray(o.acende) ? o.acende.filter(Boolean) : [],
      })),
    })),
  };
}
