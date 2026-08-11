import { useState, useMemo } from "react";
import { ClipboardCheck, Plus, Check, X } from "lucide-react";
import { VEREDITOS, uid, btnTeal, VeredictoChip, Empty, SectionTitle } from "../ui.jsx";

// Vereditos que contam como "sinal" de produto (dor recorrente).
const SINAL = ["gap", "parcial", "custom"];

export default function Curadoria({ base, saveBase, diag }) {
  const [alvoFunc, setAlvoFunc] = useState({});

  const funcName = (fid) => base.funcionalidades.find((f) => f.id === fid)?.nome || "—";
  const tarefasCuradoria = base.tarefasCuradoria || [];

  // Tarefas avulsas enviadas do Plano de projeto: vincular a uma funcionalidade ou descartar.
  const atribuirTarefa = (t, funcId) => {
    if (!funcId) return;
    const funcionalidades = base.funcionalidades.map((f) =>
      f.id === funcId
        ? { ...f, tarefas: [...(f.tarefas || []), { id: uid(), nome: t.nome, horas: Number(t.horas) || 0, area: t.area }] }
        : f);
    const restantes = (base.tarefasCuradoria || []).filter((x) => x.id !== t.id);
    saveBase({ ...base, funcionalidades, tarefasCuradoria: restantes });
    setAlvoFunc((s) => { const n = { ...s }; delete n[t.id]; return n; });
  };
  const descartarTarefa = (id) => {
    saveBase({ ...base, tarefasCuradoria: (base.tarefasCuradoria || []).filter((x) => x.id !== id) });
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

      {/* Tarefas avulsas enviadas do Plano de projeto para decidir depois. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-1">Tarefas para curar · vindas do plano de projeto ({tarefasCuradoria.length})</h3>
        <p className="text-xs text-slate-400 mb-3">Decida onde cada tarefa avulsa deve morar: vincule a uma funcionalidade ou descarte.</p>
        {tarefasCuradoria.length === 0 ? <Empty icon={ClipboardCheck} title="Nenhuma tarefa pendente" hint="Tarefas marcadas como “mandar para curadoria” no Plano de projeto aparecem aqui." />
          : <div className="space-y-2">
            {tarefasCuradoria.map((t) => (
              <div key={t.id} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-800 font-medium flex-1 min-w-0">{t.nome}</span>
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.area}</span>
                  <span className="font-mono text-xs text-slate-500 whitespace-nowrap">{t.horas} h</span>
                </div>
                {t.cliente_nome && <div className="text-xs text-slate-400 mt-0.5">origem: {t.cliente_nome}</div>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs flex-1 min-w-[180px] outline-none focus:border-teal-500"
                    value={alvoFunc[t.id] || ""}
                    onChange={(e) => setAlvoFunc((s) => ({ ...s, [t.id]: e.target.value }))}
                  >
                    <option value="">Escolha a funcionalidade…</option>
                    {base.funcionalidades.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <button className={btnTeal} disabled={!alvoFunc[t.id]} onClick={() => atribuirTarefa(t, alvoFunc[t.id])}><Check className="w-4 h-4" /> Vincular</button>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50" onClick={() => descartarTarefa(t.id)}><X className="w-4 h-4" /> Descartar</button>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
