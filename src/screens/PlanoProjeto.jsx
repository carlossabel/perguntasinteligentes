import { useState, useEffect, useRef, useMemo } from "react";
import { ListChecks, GripVertical, Save, Check, Clock, Plus, Send, Trash2 } from "lucide-react";
import { fmtDate, btnTeal, btnGhost, inputCls, uid, AREAS_CONSULTORIA, VeredictoChip, Empty, SectionTitle } from "../ui.jsx";

// Do mais crítico ao melhor — define a ordem inicial das funcionalidades/áreas no plano.
const ORDEM_TECNICA = ["gap", "custom", "parcial", "parceira", "atende", "ok"];
const idxVer = (v) => { const i = ORDEM_TECNICA.indexOf(v); return i === -1 ? 99 : i; };
const AVULSAS = "__avulsas__";

export default function PlanoProjeto({ base, saveBase, diag, saveDiag, selectedId, setSelectedId }) {
  const [saved, setSaved] = useState(false);
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const d = diag.diagnosticos.find((x) => x.id === selectedId) || diags[0];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const escopoLabel = (x) => x?.escopo_label || (x?.area_id ? "Área · " + areaNome(x.area_id) : "—");

  // Tarefas consolidadas das funcionalidades presentes no diagnóstico (uma vez por funcionalidade) + avulsas.
  const itensBase = useMemo(() => {
    if (!d) return [];
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const funcMap = new Map(); // funcId -> { f, veredito (o mais crítico) }
    rs.forEach((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const fid = r.funcionalidade_id || p?.funcionalidade_id;
      const f = base.funcionalidades.find((x) => x.id === fid);
      if (!f) return;
      const v = r.veredito || o?.veredito || "rever";
      const cur = funcMap.get(f.id);
      if (!cur || idxVer(v) < idxVer(cur.veredito)) funcMap.set(f.id, { f, veredito: v });
    });
    const itens = [];
    [...funcMap.values()].forEach(({ f, veredito }) => {
      (f.tarefas || []).forEach((t) => itens.push({
        taskId: t.id, funcId: f.id, funcNome: f.nome, veredito,
        areaId: f.area_id, areaNome: areaNome(f.area_id),
        nome: t.nome, horas: Number(t.horas) || 0, area: t.area,
      }));
    });
    // Tarefas avulsas: adicionadas direto neste projeto (não vivem na base).
    (d.tarefasExtra || []).forEach((t) => itens.push({
      taskId: t.id, funcId: null, funcNome: "Avulsas", veredito: null, avulsa: true,
      areaId: AVULSAS, areaNome: "Tarefas avulsas",
      nome: t.nome, horas: Number(t.horas) || 0, area: t.area,
    }));
    return itens;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, diag.respostas, base]);

  // Ordenações salvas: por área (ordem das funcionalidades) e por funcionalidade (ordem das tarefas).
  const [funcOrder, setFuncOrder] = useState({}); // { areaKey: [funcKey...] }
  const [taskOrder, setTaskOrder] = useState({}); // { funcKey: [taskId...] }
  useEffect(() => {
    setFuncOrder(d?.planoFuncOrder || {});
    setTaskOrder(d?.planoTaskOrder || {});
    setSaved(false);
  }, [d?.id]);

  // Monta a árvore área → funcionalidade → tarefa, aplicando as ordens salvas.
  const areaGroups = useMemo(() => {
    // 1) agrupa tarefas por funcionalidade
    const funcMap = new Map(); // funcKey -> grupo
    itensBase.forEach((it) => {
      const fk = it.funcId || AVULSAS;
      if (!funcMap.has(fk)) funcMap.set(fk, {
        funcKey: fk, funcId: it.funcId, funcNome: it.funcNome, avulsa: !!it.avulsa,
        areaKey: it.areaId || AVULSAS, areaNome: it.areaNome, veredito: it.veredito, tasks: [],
      });
      funcMap.get(fk).tasks.push(it);
    });
    // 1b) ordena tarefas dentro de cada funcionalidade
    for (const g of funcMap.values()) {
      const salvos = (taskOrder[g.funcKey] || []).filter((id) => g.tasks.some((t) => t.taskId === id));
      const rest = g.tasks.map((t) => t.taskId).filter((id) => !salvos.includes(id));
      const byId = new Map(g.tasks.map((t) => [t.taskId, t]));
      g.tasks = [...salvos, ...rest].map((id) => byId.get(id));
    }
    // 2) agrupa funcionalidades por área
    const areaMap = new Map(); // areaKey -> grupo
    for (const g of funcMap.values()) {
      if (!areaMap.has(g.areaKey)) areaMap.set(g.areaKey, {
        areaKey: g.areaKey, areaNome: g.areaNome, avulsa: g.areaKey === AVULSAS, funcs: [],
      });
      areaMap.get(g.areaKey).funcs.push(g);
    }
    // 2b) ordena funcionalidades dentro de cada área
    for (const a of areaMap.values()) {
      const salvos = (funcOrder[a.areaKey] || []).filter((fk) => a.funcs.some((g) => g.funcKey === fk));
      const rest = a.funcs.filter((g) => !salvos.includes(g.funcKey))
        .sort((x, y) => idxVer(x.veredito) - idxVer(y.veredito)).map((g) => g.funcKey);
      const byId = new Map(a.funcs.map((g) => [g.funcKey, g]));
      a.funcs = [...salvos, ...rest].map((fk) => byId.get(fk));
    }
    // 3) ordena áreas: mais crítica primeiro; avulsas por último
    const areaCrit = (a) => a.avulsa ? 999 : Math.min(...a.funcs.map((g) => idxVer(g.veredito)));
    return [...areaMap.values()].sort((a, b) => areaCrit(a) - areaCrit(b));
  }, [itensBase, funcOrder, taskOrder]);

  // ---- Drag & drop em dois níveis (funcionalidade dentro da área, tarefa dentro da funcionalidade) ----
  const dragFunc = useRef(null); // { areaKey, index }
  const dragTask = useRef(null); // { funcKey, index }
  const dropFunc = (areaKey, to, funcs) => {
    const src = dragFunc.current; dragFunc.current = null;
    if (!src || src.areaKey !== areaKey || src.index === to) return;
    const ids = funcs.map((g) => g.funcKey);
    const [m] = ids.splice(src.index, 1); ids.splice(to, 0, m);
    setFuncOrder((o) => ({ ...o, [areaKey]: ids })); setSaved(false);
  };
  const dropTask = (funcKey, to, tasks) => {
    const src = dragTask.current; dragTask.current = null;
    if (!src || src.funcKey !== funcKey || src.index === to) return;
    const ids = tasks.map((t) => t.taskId);
    const [m] = ids.splice(src.index, 1); ids.splice(to, 0, m);
    setTaskOrder((o) => ({ ...o, [funcKey]: ids })); setSaved(false);
  };

  const salvar = () => {
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => (x.id === d.id ? { ...x, planoFuncOrder: funcOrder, planoTaskOrder: taskOrder } : x)) });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // ---- Adicionar tarefa ao plano ----
  const [nova, setNova] = useState({ nome: "", horas: "", area: AREAS_CONSULTORIA[0] });
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const resetNova = () => setNova({ nome: "", horas: "", area: AREAS_CONSULTORIA[0] });
  const tarefaObj = () => ({ id: uid(), nome: nova.nome.trim(), horas: Number(nova.horas) || 0, area: nova.area });

  // Destino: só neste projeto (vive no diagnóstico, como tarefa avulsa).
  const addAoProjeto = () => {
    if (!nova.nome.trim()) return flash("Dê um nome à tarefa.");
    const t = tarefaObj();
    const diagnosticos = diag.diagnosticos.map((x) => x.id === d.id ? { ...x, tarefasExtra: [...(x.tarefasExtra || []), t] } : x);
    saveDiag && saveDiag({ ...diag, diagnosticos });
    resetNova(); flash("Tarefa adicionada só a este projeto.");
  };
  // Destino: neste projeto E na curadoria (duas cópias independentes).
  const addProjetoECuradoria = () => {
    if (!nova.nome.trim()) return flash("Dê um nome à tarefa.");
    const noProjeto = tarefaObj();
    const diagnosticos = diag.diagnosticos.map((x) => x.id === d.id ? { ...x, tarefasExtra: [...(x.tarefasExtra || []), noProjeto] } : x);
    saveDiag && saveDiag({ ...diag, diagnosticos });
    const naCuradoria = { ...noProjeto, id: uid(), cliente_nome: d.cliente_nome, origem_diagnostico_id: d.id, criado_em: new Date().toISOString() };
    saveBase && saveBase({ ...base, tarefasCuradoria: [...(base.tarefasCuradoria || []), naCuradoria] });
    resetNova(); flash("Tarefa adicionada ao projeto e enviada para a curadoria.");
  };
  const removerAvulsa = (taskId) => {
    const diagnosticos = diag.diagnosticos.map((x) => x.id === d.id ? { ...x, tarefasExtra: (x.tarefasExtra || []).filter((t) => t.id !== taskId) } : x);
    saveDiag && saveDiag({ ...diag, diagnosticos });
  };

  if (!d) return (
    <div className="max-w-3xl mx-auto">
      <Empty icon={ListChecks} title="Nenhum diagnóstico ainda" hint="Rode um diagnóstico e gere o relatório para montar o plano de projeto." />
    </div>
  );

  const totalHoras = itensBase.reduce((s, it) => s + it.horas, 0);
  const porArea = {};
  itensBase.forEach((it) => { porArea[it.area] = (porArea[it.area] || 0) + it.horas; });
  const somaHoras = (arr) => arr.reduce((s, t) => s + t.horas, 0);

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
          <button className={btnTeal} onClick={salvar} disabled={!itensBase.length}>
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saved ? "Salvo" : "Salvar ordem"}
          </button>
        </div>
      </div>

      {itensBase.length === 0 ? (
        <Empty icon={ListChecks} title="Nenhuma tarefa neste diagnóstico"
          hint="Cadastre tarefas nas funcionalidades (aba Perguntas funcionalidade) ou adicione uma tarefa abaixo." />
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
            Arraste pela alça · funcionalidades dentro da área e tarefas dentro da funcionalidade · depois “Salvar ordem”
          </p>

          <div className="space-y-4">
            {areaGroups.map((area) => (
              <div key={area.areaKey} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-teal-800 font-semibold">{area.areaNome}</span>
                  <span className="ml-auto font-mono text-xs text-slate-400 whitespace-nowrap">{somaHoras(area.funcs.flatMap((g) => g.tasks))} h</span>
                </div>
                <div className="p-3 space-y-3">
                  {area.funcs.map((g, fi) => (
                    <div key={g.funcKey}>
                      {!g.avulsa && (
                        <div onDragOver={(e) => e.preventDefault()} onDrop={() => dropFunc(area.areaKey, fi, area.funcs)}
                          className="flex items-center gap-2 mb-1.5 rounded-lg">
                          <span draggable onDragStart={() => { dragFunc.current = { areaKey: area.areaKey, index: fi }; dragTask.current = null; }}
                            title="Arraste para reordenar a funcionalidade nesta área"
                            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>
                          <VeredictoChip v={g.veredito} />
                          <span className="text-sm font-semibold text-slate-800 truncate">{g.funcNome}</span>
                          <span className="ml-auto font-mono text-xs text-slate-400 whitespace-nowrap">{somaHoras(g.tasks)} h</span>
                        </div>
                      )}
                      <div className={g.avulsa ? "space-y-2" : "space-y-2 pl-6"}>
                        {g.tasks.map((it, ti) => (
                          <div key={it.taskId} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTask(g.funcKey, ti, g.tasks)}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <span draggable onDragStart={() => { dragTask.current = { funcKey: g.funcKey, index: ti }; dragFunc.current = null; }}
                              title="Arraste para reordenar a tarefa"
                              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>
                            <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">{ti + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-800">{it.nome}</div>
                              {g.avulsa && <span className="inline-block mt-0.5 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-teal-700">avulsa</span>}
                            </div>
                            <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap shrink-0">{it.area}</span>
                            <span className="font-mono text-xs text-slate-500 whitespace-nowrap shrink-0">{it.horas} h</span>
                            {it.avulsa && (
                              <button onClick={() => removerAvulsa(it.taskId)} title="Remover tarefa avulsa"
                                className="p-1 text-slate-300 hover:text-red-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Adicionar tarefa ao plano — sempre pergunta onde ela deve morar. */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-1">
          <Plus className="w-4 h-4 text-teal-700" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400">Adicionar tarefa ao plano</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">Descreva a tarefa e escolha onde ela deve morar.</p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr,96px,200px] gap-2">
          <input className={inputCls} placeholder="ex.: Migrar cadastro de clientes" value={nova.nome}
            onChange={(e) => setNova((s) => ({ ...s, nome: e.target.value }))} />
          <input type="number" min="0" step="0.5" className={inputCls} placeholder="horas" value={nova.horas}
            onChange={(e) => setNova((s) => ({ ...s, horas: e.target.value }))} />
          <select className={inputCls} value={nova.area} onChange={(e) => setNova((s) => ({ ...s, area: e.target.value }))}>
            {AREAS_CONSULTORIA.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="mt-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-2">Onde salvar?</div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={addProjetoECuradoria}><Send className="w-4 h-4" /> Nesse projeto + curadoria</button>
            <button className={btnGhost} onClick={addAoProjeto}><ListChecks className="w-4 h-4" /> Só neste projeto</button>
          </div>
          {aviso && <p className="text-xs text-teal-700 mt-2">{aviso}</p>}
        </div>
      </div>
    </div>
  );
}
