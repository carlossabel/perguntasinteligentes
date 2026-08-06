import { useState, useMemo } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { VEREDITOS, VEREDITO_ORDER, fmtDate, btnGhost, VeredictoChip, Field, Label, Empty, SectionTitle } from "../ui.jsx";

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

  const copiar = () => {
    let t = `RELATÓRIO DE ADERÊNCIA\nCliente: ${d.cliente_nome}\nEscopo: ${escopoLabel(d)}\nData: ${fmtDate(d.criado_em)}\n\n`;
    t += `Resumo: atende ${dados.contagem.atende} · parceira ${dados.contagem.parceira} · parcial ${dados.contagem.parcial} · customização ${dados.contagem.custom} · não atende ${dados.contagem.gap} · já ok ${dados.contagem.ok}\n`;
    if (risco) t += `Risco de implantação: ${risco.faixa} (${risco.pct}%${risco.partes.length ? " · " + risco.partes.join(" + ") : ""})\n`;
    VEREDITO_ORDER.forEach((v) => {
      if (!dados.grupos[v].length) return;
      t += `\n== ${VEREDITOS[v].label.toUpperCase()} ==\n`;
      dados.grupos[v].forEach((it) => {
        t += `\n• ${it.f?.nome} [${VEREDITOS[v].short}]\n  Hoje: ${it.p?.texto} → ${it.o?.texto}\n`;
        if (v === "atende" && it.f?.como_atende) t += `  Como atende: ${it.f.como_atende}\n`;
      });
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {["gap", "parcial", "custom", "parceira", "atende", "ok"].map((v) => (
          <div key={v} className={`rounded-xl border p-4 ${VEREDITOS[v].chip}`}>
            <div className="text-3xl font-semibold">{dados.contagem[v] || 0}</div>
            <div className="font-mono text-xs uppercase tracking-wider mt-1">{VEREDITOS[v].label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {VEREDITO_ORDER.map((v) => dados.grupos[v].length > 0 && (
          <div key={v}>
            <div className="flex items-center gap-2 mb-3">
              <VeredictoChip v={v} size="lg" />
              <span className="text-sm text-slate-400">{VEREDITOS[v].desc}</span>
            </div>
            <div className="space-y-3">
              {dados.grupos[v].map((it, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-slate-900">{it.f?.nome}</h4>
                    <VeredictoChip v={v} />
                  </div>
                  <p className="text-sm text-slate-500 mb-3"><span className="font-mono text-xs uppercase tracking-wider text-slate-400">Hoje</span> · {it.p?.texto} → <span className="text-slate-700 font-medium">{it.o?.texto}</span></p>
                  {v === "atende" && it.f?.como_atende && (
                    <div className="text-sm"><Field l="Como atende">{it.f.como_atende}</Field></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {dados.outros.length > 0 && (
          <div>
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
