import { useState, useEffect, useRef, useMemo } from "react";
import { ListChecks, GripVertical, Save, Check, Clock } from "lucide-react";
import { fmtDate, btnTeal, VeredictoChip, Empty, SectionTitle } from "../ui.jsx";

// Do mais crítico ao melhor — define a ordem inicial das funcionalidades no plano.
const ORDEM_TECNICA = ["gap", "custom", "parcial", "parceira", "atende", "ok"];

export default function PlanoProjeto({ base, diag, saveDiag, selectedId, setSelectedId }) {
  const [saved, setSaved] = useState(false);
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const d = diag.diagnosticos.find((x) => x.id === selectedId) || diags[0];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const escopoLabel = (x) => x?.escopo_label || (x?.area_id ? "Área · " + areaNome(x.area_id) : "—");

  // Tarefas consolidadas das funcionalidades presentes no diagnóstico (uma vez por funcionalidade).
  const itensBase = useMemo(() => {
    if (!d) return [];
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const funcMap = new Map(); // funcId -> { f, veredito (o mais crítico) }
    rs.forEach((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const f = base.funcionalidades.find((x) => x.id === p?.funcionalidade_id);
      if (!f) return;
      const v = o?.veredito || "rever";
      const cur = funcMap.get(f.id);
      const iv = ORDEM_TECNICA.indexOf(v);
      if (!cur) funcMap.set(f.id, { f, veredito: v });
      else if (iv !== -1 && (ORDEM_TECNICA.indexOf(cur.veredito) === -1 || iv < ORDEM_TECNICA.indexOf(cur.veredito))) funcMap.set(f.id, { f, veredito: v });
    });
    const funcs = [...funcMap.values()].sort((a, b) => {
      const ia = ORDEM_TECNICA.indexOf(a.veredito), ib = ORDEM_TECNICA.indexOf(b.veredito);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const itens = [];
    funcs.forEach(({ f, veredito }) => {
      (f.tarefas || []).forEach((t) => itens.push({
        taskId: t.id, funcId: f.id, funcNome: f.nome, veredito,
        nome: t.nome, horas: Number(t.horas) || 0, area: t.area,
      }));
    });
    return itens;
  }, [d, diag.respostas, base]);

  // Aplica a ordem salva (lista de taskIds); tarefas novas entram no fim.
  const [ordem, setOrdem] = useState([]);
  useEffect(() => {
    const salvos = (d?.planoOrdem || []).filter((id) => itensBase.some((it) => it.taskId === id));
    const restantes = itensBase.map((it) => it.taskId).filter((id) => !salvos.includes(id));
    setOrdem([...salvos, ...restantes]);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, itensBase.length]);

  const itensOrdenados = useMemo(() => {
    const byId = new Map(itensBase.map((it) => [it.taskId, it]));
    const seq = ordem.map((id) => byId.get(id)).filter(Boolean);
    itensBase.forEach((it) => { if (!ordem.includes(it.taskId)) seq.push(it); });
    return seq;
  }, [ordem, itensBase]);

  const dragFrom = useRef(null);
  const reordenar = (to) => {
    const from = dragFrom.current; dragFrom.current = null;
    if (from == null || from === to) return;
    const ids = itensOrdenados.map((it) => it.taskId);
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    setOrdem(ids);
    setSaved(false);
  };

  const salvar = () => {
    const planoOrdem = itensOrdenados.map((it) => it.taskId);
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => (x.id === d.id ? { ...x, planoOrdem } : x)) });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (!d) return (
    <div className="max-w-3xl mx-auto">
      <Empty icon={ListChecks} title="Nenhum diagnóstico ainda" hint="Rode um diagnóstico e gere o relatório para montar o plano de projeto." />
    </div>
  );

  const totalHoras = itensOrdenados.reduce((s, it) => s + it.horas, 0);
  const porArea = {};
  itensOrdenados.forEach((it) => { porArea[it.area] = (porArea[it.area] || 0) + it.horas; });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub={`${d.cliente_nome} · ${escopoLabel(d)} · ${fmtDate(d.criado_em)}`}>Plano de projeto</SectionTitle>
        <div className="flex items-center gap-2">
          {diags.length > 1 && (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-xs" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
              {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
            </select>
          )}
          <button className={btnTeal} onClick={salvar} disabled={!itensOrdenados.length}>
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saved ? "Salvo" : "Salvar ordem"}
          </button>
        </div>
      </div>

      {itensOrdenados.length === 0 ? (
        <Empty icon={ListChecks} title="Nenhuma tarefa neste diagnóstico"
          hint="Cadastre tarefas de implantação nas funcionalidades (aba Perguntas funcionalidade) para montar o plano." />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-slate-400">Esforço total</div>
              <div className="text-2xl font-semibold text-teal-800 inline-flex items-center gap-1.5"><Clock className="w-5 h-5" />{totalHoras} h</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {Object.entries(porArea).map(([a, h]) => (
                <span key={a} className="inline-flex items-center gap-1"><span className="font-medium text-slate-700">{a}:</span> {h} h</span>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-3">
            Arraste pela alça para reordenar · depois clique em “Salvar ordem”
          </p>

          <div className="space-y-2">
            {itensOrdenados.map((it, i) => (
              <div key={it.taskId} onDragOver={(e) => e.preventDefault()} onDrop={() => reordenar(i)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span draggable onDragStart={() => { dragFrom.current = i; }} title="Arraste para reordenar"
                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>
                <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{it.nome}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <VeredictoChip v={it.veredito} />
                    <span className="text-xs text-slate-400 truncate">{it.funcNome}</span>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap shrink-0">{it.area}</span>
                <span className="font-mono text-xs text-slate-500 whitespace-nowrap shrink-0">{it.horas} h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
