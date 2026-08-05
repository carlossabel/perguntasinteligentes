import { useState, useMemo } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { VEREDITOS, VEREDITO_ORDER, fmtDate, btnGhost, VeredictoChip, Field, Label, Empty, SectionTitle } from "../ui.jsx";

export default function Relatorio({ base, diag, selectedId, setSelectedId }) {
  const [copied, setCopied] = useState(false);
  const diags = [...diag.diagnosticos].reverse();
  const d = diag.diagnosticos.find((x) => x.id === selectedId) || diags[0];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";

  const dados = useMemo(() => {
    if (!d) return null;
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id);
    const itens = rs.map((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const f = base.funcionalidades.find((x) => x.id === p?.funcionalidade_id);
      return { r, o, p, f, veredito: o?.veredito || "rever" };
    });
    const grupos = {}; VEREDITO_ORDER.forEach((v) => (grupos[v] = []));
    const outros = [];
    itens.forEach((it) => { if (it.veredito === "rever") outros.push(it); else grupos[it.veredito].push(it); });
    const contagem = {}; ["ok", "atende", "custom", "gap", "rever"].forEach((v) => (contagem[v] = 0));
    itens.forEach((it) => (contagem[it.veredito] = (contagem[it.veredito] || 0) + 1));
    return { itens, grupos, outros, contagem };
  }, [d, diag.respostas, base]);

  if (!d) return <div className="max-w-3xl mx-auto"><Empty icon={FileText} title="Nenhum diagnóstico ainda" hint="Rode um diagnóstico no bot para gerar o relatório." /></div>;

  const copiar = () => {
    let t = `RELATÓRIO DE ADERÊNCIA\nCliente: ${d.cliente_nome}\nÁrea: ${areaNome(d.area_id)}\nData: ${fmtDate(d.criado_em)}\n\n`;
    t += `Resumo: atende ${dados.contagem.atende} · customização ${dados.contagem.custom} · não atende ${dados.contagem.gap} · já ok ${dados.contagem.ok}\n`;
    VEREDITO_ORDER.forEach((v) => {
      if (!dados.grupos[v].length) return;
      t += `\n== ${VEREDITOS[v].label.toUpperCase()} ==\n`;
      dados.grupos[v].forEach((it) => {
        t += `\n• ${it.f?.nome} [${VEREDITOS[v].short}]\n  Hoje: ${it.p?.texto} → ${it.o?.texto}\n`;
        if (v !== "ok") {
          if (it.f?.risco) t += `  Por que importa: ${it.f.risco}\n`;
          if (it.f?.beneficio) t += `  Ganho: ${it.f.beneficio}\n`;
          if (it.f?.objetivo) t += `  Como fica: ${it.f.objetivo} ${it.f.fluxo || ""}\n`;
          if (v === "custom" && it.f?.limitacoes) t += `  Ressalva/custom: ${it.f.limitacoes}\n`;
          if (it.f?.cadastrar) t += `  Preparar: ${it.f.cadastrar}\n`;
        }
      });
    });
    if (dados.outros.length) { t += `\n== VOLTA PARA CURADORIA (Outros) ==\n`; dados.outros.forEach((it) => (t += `• ${it.f?.nome}: ${it.r.texto_outro}\n`)); }
    navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub={`${d.cliente_nome} · ${areaNome(d.area_id)} · ${fmtDate(d.criado_em)}`}>Relatório de aderência</SectionTitle>
        <div className="flex items-center gap-2">
          {diags.length > 1 && (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-xs" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
              {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
            </select>
          )}
          <button className={btnGhost} onClick={copiar}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copiado" : "Copiar"}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {["gap", "custom", "atende", "ok"].map((v) => (
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
                  {v !== "ok" && (
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      {it.f?.risco && <Field l="Por que importa">{it.f.risco}</Field>}
                      {it.f?.beneficio && <Field l="Ganho">{it.f.beneficio}</Field>}
                      {(it.f?.objetivo || it.f?.fluxo) && <Field l="Como fica (TO-BE)">{[it.f?.objetivo, it.f?.fluxo].filter(Boolean).join(" ")}</Field>}
                      {v === "custom" && it.f?.limitacoes && <Field l="Ressalva / customização">{it.f.limitacoes}</Field>}
                      {it.f?.cadastrar && <Field l="Preparar no sistema">{it.f.cadastrar}</Field>}
                    </div>
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
