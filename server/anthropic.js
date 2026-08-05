const VEREDITOS_VALIDOS = ["ok", "atende", "custom", "gap", "rever"];

function montarPrompt(tema, recusadas) {
  const contexto = recusadas && recusadas.length
    ? "\n\nNÃO repita estas perguntas já rejeitadas por um humano (com o motivo):\n" +
      recusadas.map((r) => `- "${r.texto}" (motivo: ${r.motivo || "sem motivo"})`).join("\n")
    : "";

  return `Você ajuda a cadastrar uma funcionalidade de software e montar seu diagnóstico de PROCESSO para o tema "${tema}".
Devolva dois blocos:
(1) "descricao" com: objetivo, fluxo (passos numerados em um texto), beneficio, risco (o risco de o cliente NÃO ter isso), limitacoes e cadastrar (pré-requisitos a cadastrar no sistema).
(2) "perguntas": de 2 a 3 perguntas de múltipla escolha sobre COMO a empresa faz esse processo HOJE (não sobre o sistema atual dela). No máximo 5 opções por pergunta.
Cada opção tem um veredito: "ok" (já faz bem), "atende" (dor que o software resolve padrão), "custom" (só via customização), "gap" (não atende). Sempre inclua por último a opção "Outro" com veredito "rever".${contexto}

Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:
{"descricao":{"objetivo":"","fluxo":"","beneficio":"","risco":"","limitacoes":"","cadastrar":""},"perguntas":[{"pergunta":"","opcoes":[{"texto":"","veredito":"ok|atende|custom|gap|rever"}]}]}`;
}

function extrairJSON(texto) {
  const clean = texto.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const json = start >= 0 ? clean.slice(start, end + 1) : clean;
  return JSON.parse(json);
}

/**
 * Chama a API da Anthropic (server-side). Injeta as perguntas recusadas
 * daquela área como contexto de "não perguntar" — é isso que faz a IA
 * aprender entre sessões (a memória vive no banco, não no modelo).
 */
export async function gerarComIA({ tema, recusadas, model, apiKey }) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: montarPrompt(tema, recusadas) }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${t.slice(0, 300)}`);
  }

  const data = await resp.json();
  const texto = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const out = extrairJSON(texto);

  // saneamento leve
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
