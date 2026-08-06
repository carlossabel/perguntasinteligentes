import { useState, useMemo } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { VEREDITOS, VEREDITO_ORDER, fmtDate, btnGhost, VeredictoChip, Field, Label, Empty, SectionTitle } from "../ui.jsx";

// Ordem de leitura comercial: começa pelo que atendemos (confiança), termina no gap (honestidade).
const ORDEM_VENDA = ["atende", "ok", "parceira", "parcial", "custom", "gap"];

// Lado "Como podemos atender" — tom consultivo por veredito.
function comoAtendemos(it) {
  switch (it.veredito) {
    case "atende": return it.f?.como_atende?.trim() || "Atendemos esse processo de forma nativa, sem esforço adicional.";
    case "ok": return "Já bem resolvido no cliente — sem esforço de implantação da nossa parte.";
    case "parceira": return "Atendemos por meio de parceiro/integração homologada.";
    case "parcial": return "Atendemos parcialmente; resta um ajuste a dimensionar no projeto.";
    case "custom": return "Atendemos via customização — escopo a dimensionar em conjunto.";
    case "gap": return "Hoje não cobrimos isso nativamente; ponto a avaliar como evolução/roadmap.";
    default: return "";
  }
}

export default function Relatorio({ base, diag, selectedId, setSelectedId }) {
  const [copied, setCopied] = useState(false);
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const d = diag.diagnosticos.find((x) => x.id === selectedId) || diags[0];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const escopoLabel = (x) => x?.escopo_label || (x?.area_id ? "Área · " + areaNome(x.area_id) : "—");

  const dados = useMemo(() => {
    if (!d) return null;
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const itens = rs.map((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const f = base.funcionalidades.find((x) => x.id === p?.funcionalidade_id);
      return { r, o, p, f, veredito: o?.veredito || "rever" };
    });
    const grupos = {}; VEREDITO_ORDER.forEach((v) => (grupos[v] = []));
    const outros = [];
    itens.forEach((it) => { if (it.veredito === "rever") outros.push(it); else grupos[it.veredito].push(it); });
    const contagem = {}; ["ok", "atende", "parceira", "parcial", "custom", "gap", "rever"].forEach((v) => (contagem[v] = 0));
    itens.forEach((it) => (contagem[it.veredito] = (contagem[it.veredito] || 0) + 1));
    return { itens, grupos, outros, contagem };
  }, [d, diag.respostas, base]);

  // Risco de implantação: vem só dos vereditos técnicos. atende/ok = 0.
  const risco = useMemo(() => {
    if (!dados) return null;
    const P = { gap: 1, custom: 0.5, parcial: 0.4, parceira: 0.25, atende: 0, ok: 0 };
    const c = dados.contagem;
    const avaliados = c.gap + c.custom + c.parcial + c.parceira + c.atende + c.ok; // exclui "rever" (Outro)
    if (!avaliados) return null;
    const soma = c.gap * P.gap + c.custom * P.custom + c.parcial * P.parcial + c.parceira * P.parceira;
    const pct = Math.round((soma / avaliados) * 100);
    const faixa = pct >= 60 ? "Alto" : pct >= 30 ? "Médio" : "Baixo";
    const partes = [];
    if (c.gap) partes.push(`${c.gap} não atende`);
    if (c.custom) partes.push(`${c.custom} customização${c.custom > 1 ? "ões" : ""}`);
    if (c.parcial) partes.push(`${c.parcial} parcial${c.parcial > 1 ? "is" : ""}`);
    if (c.parceira) partes.push(`${c.parceira} via parceiro`);
    return { pct, faixa, avaliados, partes };
  }, [dados]);

  if (!d) return <div className="max-w-3xl mx-auto"><Empty icon={FileText} title="Nenhum diagnóstico ainda" hint="Rode um diagnóstico no bot para gerar o relatório." /></div>;

  const linhas = dados ? dados.itens.filter((it) => it.veredito !== "rever").slice().sort((a, b) => ORDEM_VENDA.indexOf(a.veredito) - ORDEM_VENDA.indexOf(b.veredito)) : [];
  const sintese = (() => {
    if (!dados) return "";
    const c = dados.contagem;
    const avaliados = c.atende + c.ok + c.parceira + c.parcial + c.custom + c.gap;
    if (!avaliados) return "Nenhum processo avaliado ainda.";
    const diretos = c.atende + c.ok, ressalva = c.parceira + c.parcial + c.custom;
    let s = `De ${avaliados} processo${avaliados > 1 ? "s" : ""} avaliado${avaliados > 1 ? "s" : ""}, atendemos ${diretos} diretamente`;
    if (ressalva) s += `, ${ressalva} com ressalva (parceiro, parcial ou customização)`;
    if (c.gap) s += ` e ${c.gap} é${c.gap > 1 ? "(são)" : ""} lacuna${c.gap > 1 ? "s" : ""}`;
    s += ".";
    if (risco) s += ` Risco de implantação: ${risco.faixa}.`;
    return s;
  })();

  const copiar = () => {
    let t = `RELATÓRIO DE ADERÊNCIA\nCliente: ${d.cliente_nome}\nEscopo: ${escopoLabel(d)}\nData: ${fmtDate(d.criado_em)}\n\n`;
    t += sintese + "\n";
    t += `\nResumo: atende ${dados.contagem.atende} · parceira ${dados.contagem.parceira} · parcial ${dados.contagem.parcial} · customização ${dados.contagem.custom} · não atende ${dados.contagem.gap} · já ok ${dados.contagem.ok}\n`;
    t += `\n— COMO É HOJE  →  COMO PODEMOS ATENDER —\n`;
    linhas.forEach((it) => {
      const hoje = it.r?.texto_outro ? `Outro: ${it.r.texto_outro}` : it.o?.texto;
      t += `\n• ${it.f?.nome} [${VEREDITOS[it.veredito].short}]\n  Hoje: ${it.p?.texto} → ${hoje}\n  Atendemos: ${comoAtendemos(it)}\n`;
    });
    if (dados.outros.length) { t += `\n== VOLTA PARA CURADORIA (Outros) ==\n`; dados.outros.forEach((it) => (t += `• ${it.f?.nome}: ${it.r.texto_outro}\n`)); }
    navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub={`${d.cliente_nome} · ${escopoLabel(d)} · ${fmtDate(d.criado_em)}`}>Relatório de aderência</SectionTitle>
        <div className="flex items-center gap-2">
          {diags.length > 1 && (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-xs" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
              {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
            </select>
          )}
          <button className={btnGhost} onClick={copiar}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copiado" : "Copiar"}</button>
        </div>
      </div>

      {risco && (
        <div className={`rounded-xl border p-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 ${risco.faixa === "Alto" ? "bg-red-50 border-red-300" : risco.faixa === "Médio" ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-300"}`}>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500">Risco de implantação</div>
            <div className={`text-2xl font-semibold ${risco.faixa === "Alto" ? "text-red-700" : risco.faixa === "Médio" ? "text-amber-800" : "text-emerald-700"}`}>{risco.faixa}</div>
          </div>
          <div className="text-sm text-slate-600">
            {risco.pct}% do risco máximo · {risco.partes.length ? `${risco.partes.join(" + ")} de ${risco.avaliados} itens` : "tudo coberto pelo sistema"}
          </div>
        </div>
      )}

      {sintese && <p className="text-sm text-slate-600 mb-5 leading-relaxed">{sintese}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {["gap", "parcial", "custom", "parceira", "atende", "ok"].map((v) => (
          <div key={v} className={`rounded-xl border p-4 ${VEREDITOS[v].chip}`}>
            <div className="text-3xl font-semibold">{dados.contagem[v] || 0}</div>
            <div className="font-mono text-xs uppercase tracking-wider mt-1">{VEREDITOS[v].label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {linhas.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
              <VeredictoChip v={it.veredito} />
              <span className="font-semibold text-slate-900">{it.f?.nome}</span>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="p-4 bg-slate-50/60 sm:border-r border-slate-100">
                <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-1">Como é hoje</div>
                <div className="text-sm text-slate-500">{it.p?.texto}</div>
                <div className="text-sm text-slate-800 font-medium mt-1">{it.r?.texto_outro ? `Outro: ${it.r.texto_outro}` : it.o?.texto}</div>
              </div>
              <div className="p-4">
                <div className="font-mono text-[11px] uppercase tracking-widest text-teal-600 mb-1">Como podemos atender</div>
                <div className="text-sm text-slate-700">{comoAtendemos(it)}</div>
              </div>
            </div>
          </div>
        ))}

        {dados.outros.length > 0 && (
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-3"><VeredictoChip v="rever" size="lg" /><span className="text-sm text-slate-400">respostas em texto livre → voltam para a curadoria</span></div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 space-y-2">
              {dados.outros.map((it, i) => (
                <div key={i} className="text-sm"><span className="font-medium text-slate-700">{it.f?.nome}:</span> <span className="text-slate-600">{it.r.texto_outro}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
