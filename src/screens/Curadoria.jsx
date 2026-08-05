import { useState, useMemo } from "react";
import { ClipboardCheck, Plus, Check, X, Edit3 } from "lucide-react";
import { VEREDITOS, uid, inputCls, btnTeal, btnGhost, VeredictoChip, Empty, SectionTitle } from "../ui.jsx";

// Vereditos que contam como "sinal" de produto (dor recorrente).
const SINAL = ["gap", "parcial", "custom"];

export default function Curadoria({ base, saveBase, diag }) {
  const [motivos, setMotivos] = useState({});
  const [editando, setEditando] = useState({});
  const avaliador = "consultor";

  const sugeridas = base.perguntas.filter((p) => p.status === "sugerida");
  const recusadas = base.perguntas.filter((p) => p.status === "recusada");
  const funcName = (fid) => base.funcionalidades.find((f) => f.id === fid)?.nome || "—";

  const setStatus = (pid, status, extra = {}) => {
    const perguntas = base.perguntas.map((p) => p.id === pid ? { ...p, status, avaliado_por: avaliador, ...extra } : p);
    saveBase({ ...base, perguntas });
  };
  const salvarAjuste = (pid) => {
    const perguntas = base.perguntas.map((p) => p.id === pid ? { ...p, texto: editando[pid], status: "aprovada", avaliado_por: avaliador } : p);
    saveBase({ ...base, perguntas });
    setEditando((e) => { const n = { ...e }; delete n[pid]; return n; });
  };

  // Curadoria muda a realidade: reclassifica o veredito de uma opção.
  const mudarVeredito = (opcaoId, novo) => {
    const opcoes = base.opcoes.map((o) => o.id === opcaoId ? { ...o, veredito: novo } : o);
    saveBase({ ...base, opcoes });
  };

  const outros = useMemo(() => {
    const map = {};
    diag.respostas.filter((r) => r.texto_outro && r.texto_outro.trim()).forEach((r) => {
      const norm = r.texto_outro.trim().toLowerCase();
      if (!map[norm]) map[norm] = { texto: r.texto_outro.trim(), count: 0, pergunta_id: r.pergunta_id };
      map[norm].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [diag.respostas]);

  const sinais = useMemo(() => {
    const acc = {};
    diag.respostas.forEach((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      if (!o || !SINAL.includes(o.veredito)) return;
      if (!acc[o.id]) acc[o.id] = { id: o.id, texto: o.texto, veredito: o.veredito, count: 0, funcionalidade: funcName(base.perguntas.find((p) => p.id === o.pergunta_id)?.funcionalidade_id) };
      acc[o.id].count++;
    });
    return Object.values(acc).sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diag.respostas, base.opcoes]);

  const promoverOutro = (o) => {
    const ordem = base.opcoes.filter((x) => x.pergunta_id === o.pergunta_id).length;
    const opcoes = [...base.opcoes, { id: uid(), pergunta_id: o.pergunta_id, texto: o.texto, veredito: "atende", ordem }];
    saveBase({ ...base, opcoes });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SectionTitle sub="A memória do sistema. O que você aprova, recusa (com motivo), promove e reclassifica aqui alimenta as próximas gerações da IA.">Curadoria</SectionTitle>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-3">“Outros” recorrentes ({outros.length})</h3>
        {outros.length === 0 ? <p className="text-sm text-slate-400 py-2">Nada capturado ainda. Respostas “Outro” do diagnóstico caem aqui.</p>
          : <div className="space-y-2">
            {outros.map((o, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="font-mono text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">{o.count}×</span>
                <span className="text-sm text-slate-700 flex-1">{o.texto}</span>
                <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={() => promoverOutro(o)}><Plus className="w-3 h-3" /> virar opção</button>
              </div>
            ))}
          </div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-1">Sinais · gaps, parciais &amp; customs recorrentes ({sinais.length})</h3>
        <p className="text-xs text-slate-400 mb-3">Mudou de figura? Reclassifique o veredito aqui — some da lista quando deixa de ser dor.</p>
        {sinais.length === 0 ? <p className="text-sm text-slate-400 py-2">Rode alguns diagnósticos para ver o mercado pedindo o que construir.</p>
          : <div className="space-y-2">
            {sinais.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="font-mono text-xs bg-slate-200 text-slate-700 rounded-full px-2 py-0.5">{s.count}×</span>
                <VeredictoChip v={s.veredito} />
                <span className="text-sm text-slate-700 flex-1">{s.texto} <span className="text-slate-400">· {s.funcionalidade}</span></span>
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono outline-none focus:border-teal-500"
                  value={s.veredito}
                  onChange={(e) => mudarVeredito(s.id, e.target.value)}
                  title="Mudar veredito desta opção"
                >
                  {Object.keys(VEREDITOS).map((v) => <option key={v} value={v}>{VEREDITOS[v].short}</option>)}
                </select>
              </div>
            ))}
          </div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-3">Recusadas · o “não perguntar” reinjetado na IA ({recusadas.length})</h3>
        {recusadas.length === 0 ? <p className="text-sm text-slate-400 py-2">Nenhuma pergunta recusada ainda.</p>
          : <div className="space-y-2">
            {recusadas.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm text-slate-500 line-through">{p.texto}</p>
                {p.motivo && <p className="text-xs text-red-600 mt-0.5">motivo: {p.motivo}</p>}
              </div>
            ))}
          </div>}
      </div>

      {/* Fila de sugeridas: por último, como a fila de trabalho pendente. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-3">Fila · perguntas sugeridas ({sugeridas.length})</h3>
        {sugeridas.length === 0 ? <Empty icon={ClipboardCheck} title="Fila vazia" hint="Perguntas marcadas como “curar depois” no cadastro aparecem aqui." />
          : <div className="space-y-3">
            {sugeridas.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-teal-700 mb-1">{funcName(p.funcionalidade_id)} · {p.origem}</div>
                {editando[p.id] !== undefined ? (
                  <textarea className={inputCls + " mb-2"} value={editando[p.id]} onChange={(e) => setEditando((s) => ({ ...s, [p.id]: e.target.value }))} />
                ) : <p className="text-slate-800 mb-3">{p.texto}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {editando[p.id] !== undefined ? (
                    <>
                      <button className={btnTeal} onClick={() => salvarAjuste(p.id)}><Check className="w-4 h-4" /> Salvar ajuste</button>
                      <button className={btnGhost} onClick={() => setEditando((s) => { const n = { ...s }; delete n[p.id]; return n; })}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className={btnTeal} onClick={() => setStatus(p.id, "aprovada")}><Check className="w-4 h-4" /> Aprovar</button>
                      <button className={btnGhost} onClick={() => setEditando((s) => ({ ...s, [p.id]: p.texto }))}><Edit3 className="w-4 h-4" /> Ajustar</button>
                      <div className="flex items-center gap-1 ml-auto">
                        <input className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs w-40" placeholder="motivo da recusa" value={motivos[p.id] || ""} onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} />
                        <button className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50" onClick={() => setStatus(p.id, "recusada", { motivo: motivos[p.id] || "" })}><X className="w-4 h-4" /> Recusar</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
