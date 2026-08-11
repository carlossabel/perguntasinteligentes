import { useState, useEffect, useRef, useMemo } from "react";
import { ListChecks, GripVertical, Save, Check, Clock, Plus, Send, Trash2, StickyNote } from "lucide-react";
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
    // Tarefas do projeto (não vivem na base). Podem apontar para uma funcionalidade (funcId) ou serem avulsas.
    (d.tarefasExtra || []).forEach((t) => {
      if (t.funcId) {
        const f = base.funcionalidades.find((x) => x.id === t.funcId);
        itens.push({
          taskId: t.id, funcId: t.funcId, funcNome: f?.nome || "—", veredito: funcMap.get(t.funcId)?.veredito ?? null,
          areaId: f?.area_id || AVULSAS, areaNome: f ? areaNome(f.area_id) : "Tarefas avulsas",
          nome: t.nome, horas: Number(t.horas) || 0, area: t.area, extra: true,
        });
      } else {
        itens.push({
          taskId: t.id, funcId: null, funcNome: "Avulsas", veredito: null, avulsa: true, extra: true,
          areaId: AVULSAS, areaNome: "Tarefas avulsas",
          nome: t.nome, horas: Number(t.horas) || 0, area: t.area,
        });
      }
    });
    return itens;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, diag.respostas, base]);

  // Funcionalidades presentes neste diagnóstico (para escolher onde a tarefa nova entra).
  const funcsNoPlano = useMemo(() => {
    if (!d) return [];
    const ids = new Set();
    diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial").forEach((r) => {
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const fid = r.funcionalidade_id || p?.funcionalidade_id;
      if (fid) ids.add(fid);
    });
    return base.funcionalidades.filter((f) => ids.has(f.id));
  }, [d, diag.respostas, base]);

  // Ordenações salvas: por área (sequência das áreas), por área→funcionalidades e por funcionalidade→tarefas.
  const [areaOrder, setAreaOrder] = useState([]); // [areaKey...]
  const [funcOrder, setFuncOrder] = useState({}); // { areaKey: [funcKey...] }
  const [taskOrder, setTaskOrder] = useState({}); // { funcKey: [taskId...] }
  useEffect(() => {
    setAreaOrder(d?.planoAreaOrder || []);
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
    // 3) ordena áreas: sequência salva primeiro; depois mais crítica; avulsas por último
    const areaCrit = (a) => a.avulsa ? 999 : Math.min(...a.funcs.map((g) => idxVer(g.veredito)));
    const lista = [...areaMap.values()];
    const salvasA = (areaOrder || []).filter((ak) => lista.some((a) => a.areaKey === ak));
    const restA = lista.filter((a) => !salvasA.includes(a.areaKey)).sort((a, b) => areaCrit(a) - areaCrit(b)).map((a) => a.areaKey);
    const byA = new Map(lista.map((a) => [a.areaKey, a]));
    return [...salvasA, ...restA].map((ak) => byA.get(ak));
  }, [itensBase, funcOrder, taskOrder, areaOrder]);

  // ---- Drag & drop em três níveis (área, funcionalidade dentro da área, tarefa dentro da funcionalidade) ----
  const dragArea = useRef(null); // { index }
  const dragFunc = useRef(null); // { areaKey, index }
  const dragTask = useRef(null); // { funcKey, index }
  const dropArea = (to, areas) => {
    const src = dragArea.current; dragArea.current = null;
    if (!src || src.index === to) return;
    const ids = areas.map((a) => a.areaKey);
    const [m] = ids.splice(src.index, 1); ids.splice(to, 0, m);
    setAreaOrder(ids); setSaved(false);
  };
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
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => (x.id === d.id ? { ...x, planoAreaOrder: areaOrder, planoFuncOrder: funcOrder, planoTaskOrder: taskOrder } : x)) });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // ---- Adicionar tarefa ao plano ----
  const [nova, setNova] = useState({ nome: "", horas: "", area: AREAS_CONSULTORIA[0], funcId: "" });
  const [aviso, setAviso] = useState("");
  const flash = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const resetNova = () => setNova({ nome: "", horas: "", area: AREAS_CONSULTORIA[0], funcId: "" });
  const tarefaObj = () => ({ id: uid(), nome: nova.nome.trim(), horas: Number(nova.horas) || 0, area: nova.area, funcId: nova.funcId || null });

  // Destino: só neste projeto (vive no diagnóstico; entra na funcionalidade escolhida ou como avulsa).
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
  const removerExtra = (taskId) => {
    const diagnosticos = diag.diagnosticos.map((x) => {
      if (x.id !== d.id) return x;
      const notas = { ...(x.planoNotas || {}) }; delete notas[taskId];
      return { ...x, tarefasExtra: (x.tarefasExtra || []).filter((t) => t.id !== taskId), planoNotas: notas };
    });
    saveDiag && saveDiag({ ...diag, diagnosticos });
  };

  // ---- Nota por tarefa (orientação para quem executa) — guardada por diagnóstico ----
  const planoNotas = d?.planoNotas || {};
  const [notaEdit, setNotaEdit] = useState(null); // taskId em edição
  const [notaDraft, setNotaDraft] = useState("");
  const abrirNota = (taskId) => { setNotaDraft(planoNotas[taskId] || ""); setNotaEdit(taskId); };
  const salvarNota = (taskId) => {
    const txt = notaDraft.trim();
    const diagnosticos = diag.diagnosticos.map((x) => {
      if (x.id !== d.id) return x;
      const notas = { ...(x.planoNotas || {}) };
      if (txt) notas[taskId] = txt; else delete notas[taskId];
      return { ...x, planoNotas: notas };
    });
    saveDiag && saveDiag({ ...diag, diagnosticos });
    setNotaEdit(null); setNotaDraft("");
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
            Arraste pela alça · áreas, funcionalidades dentro da área e tarefas dentro da funcionalidade · depois “Salvar ordem”
          </p>

          <div className="space-y-4">
            {areaGroups.map((area, ai) => (
              <div key={area.areaKey} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div onDragOver={(e) => e.preventDefault()} onDrop={() => dropArea(ai, areaGroups)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span draggable onDragStart={() => { dragArea.current = { index: ai }; dragFunc.current = null; dragTask.current = null; }}
                    title="Arraste para reordenar a área"
                    className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-teal-800 font-semibold">{area.areaNome}</span>
                  <span className="ml-auto font-mono text-xs text-slate-400 whitespace-nowrap">{somaHoras(area.funcs.flatMap((g) => g.tasks))} h</span>
                </div>
                <div className="p-3 space-y-3">
                  {area.funcs.map((g, fi) => (
                    <div key={g.funcKey}>
                      <div onDragOver={(e) => e.preventDefault()} onDrop={() => dropFunc(area.areaKey, fi, area.funcs)}
                        className="flex items-center gap-2 mb-1.5 rounded-lg">
                        {g.avulsa
                          ? <span className="w-5 shrink-0" />
                          : <span draggable onDragStart={() => { dragFunc.current = { areaKey: area.areaKey, index: fi }; dragTask.current = null; dragArea.current = null; }}
                              title="Arraste para reordenar a funcionalidade nesta área"
                              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>}
                        {g.avulsa
                          ? <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-mono uppercase tracking-wider text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />avulsas</span>
                          : <VeredictoChip v={g.veredito} />}
                        <span className={g.avulsa ? "text-sm text-slate-500 truncate" : "text-sm font-semibold text-slate-800 truncate"}>{g.avulsa ? "Sem funcionalidade" : g.funcNome}</span>
                        <span className="ml-auto font-mono text-xs text-slate-400 whitespace-nowrap">{somaHoras(g.tasks)} h</span>
                      </div>
                      <div className="space-y-2 pl-6">
                        {g.tasks.map((it, ti) => (
                          <div key={it.taskId} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTask(g.funcKey, ti, g.tasks)}
                            className="rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-3 p-3">
                              <span draggable onDragStart={() => { dragTask.current = { funcKey: g.funcKey, index: ti }; dragFunc.current = null; dragArea.current = null; }}
                                title="Arraste para reordenar a tarefa"
                                className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-5 h-5" /></span>
                              <span className="font-mono text-xs text-slate-400 w-6 text-right shrink-0">{ti + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-800">{it.nome}</div>
                              </div>
                              <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap shrink-0">{it.area}</span>
                              <span className="font-mono text-xs text-slate-500 whitespace-nowrap shrink-0">{it.horas} h</span>
                              <button onClick={() => (notaEdit === it.taskId ? setNotaEdit(null) : abrirNota(it.taskId))}
                                title={planoNotas[it.taskId] ? "Editar nota" : "Adicionar nota"}
                                className={"p-1 shrink-0 " + (planoNotas[it.taskId] ? "text-teal-600 hover:text-teal-700" : "text-slate-300 hover:text-teal-600")}><StickyNote className="w-4 h-4" /></button>
                              {it.extra && (
                                <button onClick={() => removerExtra(it.taskId)} title="Remover tarefa do projeto"
                                  className="p-1 text-slate-300 hover:text-red-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </div>
                            {notaEdit === it.taskId ? (
                              <div className="px-3 pb-3 pl-14">
                                <textarea autoFocus className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-y" style={{ minHeight: 60 }}
                                  placeholder="Orientação para quem for executar esta tarefa…" value={notaDraft} onChange={(e) => setNotaDraft(e.target.value)} />
                                <div className="flex items-center gap-2 mt-1.5">
                                  <button className={btnTeal} onClick={() => salvarNota(it.taskId)}><Check className="w-4 h-4" /> Salvar nota</button>
                                  <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={() => { setNotaEdit(null); setNotaDraft(""); }}>Cancelar</button>
                                </div>
                              </div>
                            ) : planoNotas[it.taskId] ? (
                              <div className="px-3 pb-3 pl-14">
                                <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2 flex gap-2">
                                  <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="text-sm text-slate-700 whitespace-pre-wrap flex-1">{planoNotas[it.taskId]}</span>
                                  <button onClick={() => abrirNota(it.taskId)} className="text-xs text-teal-700 hover:underline shrink-0">editar</button>
                                </div>
                              </div>
                            ) : null}
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

        <div className="mt-2">
          <label className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Em qual funcionalidade?</label>
          <select className={inputCls + " mt-1"} value={nova.funcId} onChange={(e) => setNova((s) => ({ ...s, funcId: e.target.value }))}>
            <option value="">Avulsa (sem funcionalidade)</option>
            {funcsNoPlano.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
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
