import { useState } from "react";
import { ClipboardList, GripVertical, Plus, Trash2, Check, X, PencilLine, Layers, Clock, User, Sparkles, ClipboardCheck } from "lucide-react";
import { VEREDITOS, VeredictoChip, SectionTitle, Empty, uid, nowISO, fmtDate, inputCls, btnTeal, btnGhost } from "../ui.jsx";

const horas = (n) => `${Number(n) || 0}h`;

/* Ordena `items` (com .id) conforme a lista de ids salva no plano. */
function orderedBy(savedOrder, items) {
  const pos = new Map((savedOrder || []).map((id, i) => [id, i]));
  return items
    .map((it, i) => ({ it, k: pos.has(it.id) ? pos.get(it.id) : (savedOrder ? savedOrder.length + i : i) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it);
}

/* Drag-and-drop simples (HTML5) para reordenar uma lista de ids. */
function useReorder(orderedIds, onCommit) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const handleProps = (id) => ({
    draggable: true,
    onDragStart: (e) => { setDragId(id); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); } catch {} },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });
  const rowProps = (id) => ({
    onDragOver: (e) => { if (dragId && dragId !== id) { e.preventDefault(); setOverId(id); } },
    onDragLeave: () => setOverId((o) => (o === id ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      if (dragId && dragId !== id) {
        const a = [...orderedIds]; const from = a.indexOf(dragId); const to = a.indexOf(id);
        if (from > -1 && to > -1) { a.splice(from, 1); a.splice(to, 0, dragId); onCommit(a); }
      }
      setDragId(null); setOverId(null);
    },
  });
  return { dragId, overId, handleProps, rowProps };
}

function Grip({ handleProps }) {
  return (
    <span {...handleProps} title="Arraste para reordenar"
      className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-teal-600 shrink-0 select-none">
      <GripVertical className="w-4 h-4" />
    </span>
  );
}

/* Formulário de tarefa (nome, tempo, consultor). */
function TarefaForm({ inicial, listId, onSalvar, onCancelar, textoBotao = "Continuar" }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [tempo, setTempo] = useState(inicial?.tempo ?? "");
  const [consultor, setConsultor] = useState(inicial?.consultor || "");
  const salvar = () => {
    if (!nome.trim()) return;
    onSalvar({ nome: nome.trim(), tempo: Number(tempo) || 0, consultor: consultor.trim() });
    if (!inicial) { setNome(""); setTempo(""); setConsultor(""); }
  };
  const onKey = (e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape" && onCancelar) onCancelar(); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={inputCls + " py-1 flex-1 min-w-[10rem]"} placeholder="Nome da tarefa" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={onKey} autoFocus />
      <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /><input type="number" min="0" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500" placeholder="h" value={tempo} onChange={(e) => setTempo(e.target.value)} onKeyDown={onKey} /></div>
      <div className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /><input list={listId} className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500" placeholder="Consultor" value={consultor} onChange={(e) => setConsultor(e.target.value)} onKeyDown={onKey} /></div>
      <button className={btnGhost + " py-1.5"} onClick={salvar}><Check className="w-4 h-4" /> {textoBotao}</button>
      {onCancelar && <button className="p-1.5 text-slate-400 hover:text-red-600" onClick={onCancelar}><X className="w-4 h-4" /></button>}
    </div>
  );
}

/* Escolha do destino ao adicionar uma tarefa no plano. */
function EscolhaDestino({ tarefa, onEscolher, onCancelar }) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 space-y-2">
      <p className="text-sm text-slate-700">Onde adicionar <b>“{tarefa.nome}”</b> ({horas(tarefa.tempo)}{tarefa.consultor ? ` · ${tarefa.consultor}` : ""})?</p>
      <div className="flex flex-wrap gap-2">
        <button className={btnTeal} onClick={() => onEscolher("catalogo")}><Sparkles className="w-4 h-4" /> Na funcionalidade (oficial)</button>
        <button className={btnGhost} onClick={() => onEscolher("plano")}><ClipboardList className="w-4 h-4" /> Só neste plano</button>
        <button className={btnGhost} onClick={() => onEscolher("curadoria")}><ClipboardCheck className="w-4 h-4" /> Mandar p/ curadoria</button>
        <button className="p-2 text-slate-400 hover:text-red-600" onClick={onCancelar}><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-slate-500">
        <b>Oficial</b>: entra no catálogo da funcionalidade e volta nos próximos relatórios. ·
        <b> Só neste plano</b>: fica apenas aqui. ·
        <b> Curadoria</b>: vai para a fila decidir depois (não entra no plano agora).
      </p>
    </div>
  );
}

function TarefaRow({ t, feita, extra, listId, over, handleProps, rowProps, onToggle, onSalvar, onDel }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <div className="rounded-lg border border-teal-200 bg-white px-2 py-2">
        <TarefaForm inicial={t} listId={listId} textoBotao="Salvar" onSalvar={(v) => { onSalvar(v); setEditando(false); }} onCancelar={() => setEditando(false)} />
      </div>
    );
  }
  return (
    <div {...rowProps} className={`flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 ${over ? "border-teal-400 ring-2 ring-teal-200" : "border-slate-100"}`}>
      <Grip handleProps={handleProps} />
      <input type="checkbox" checked={!!feita} onChange={onToggle} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
      <span className={`flex-1 text-sm ${feita ? "line-through text-slate-400" : "text-slate-700"}`}>
        {t.nome}
        {extra && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 rounded px-1 py-0.5">só neste plano</span>}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono"><Clock className="w-3 h-3" />{horas(t.tempo)}</span>
      {t.consultor && <span className="inline-flex items-center gap-1 text-xs text-slate-500 max-w-[9rem] truncate"><User className="w-3 h-3" />{t.consultor}</span>}
      <button className="p-1 text-slate-300 hover:text-teal-700" onClick={() => setEditando(true)}><PencilLine className="w-4 h-4" /></button>
      <button className="p-1 text-slate-300 hover:text-red-600" onClick={onDel}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

function FuncBlock({ f, veredito, tarefas, feitas, extraIds, listId, over, handleProps, rowProps, onReorderTarefas, onAdd, onToggle, onSalvarT, onDelT }) {
  const [abrindo, setAbrindo] = useState(false);
  const [pendente, setPendente] = useState(null);
  const dnd = useReorder(tarefas.map((t) => t.id), onReorderTarefas);
  const feitasN = tarefas.filter((t) => feitas[t.id]).length;
  const totalH = tarefas.reduce((a, t) => a + (Number(t.tempo) || 0), 0);
  const escolher = (destino) => { onAdd(pendente, destino); setPendente(null); setAbrindo(false); };
  return (
    <div {...rowProps} className={`rounded-xl border bg-slate-50 p-3 ${over ? "border-teal-400 ring-2 ring-teal-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Grip handleProps={handleProps} />
        <span className="font-medium text-slate-800 flex-1">{f.nome}</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400"><Clock className="w-3 h-3" />{horas(totalH)}</span>
        <span className="font-mono text-xs text-slate-400">{feitasN}/{tarefas.length}</span>
        <VeredictoChip v={veredito} />
      </div>
      <div className="space-y-1.5 pl-1">
        {tarefas.map((t) => (
          <TarefaRow key={t.id} t={t} feita={feitas[t.id]} extra={extraIds.has(t.id)} listId={listId}
            over={dnd.overId === t.id} handleProps={dnd.handleProps(t.id)} rowProps={dnd.rowProps(t.id)}
            onToggle={() => onToggle(t.id)} onSalvar={(v) => onSalvarT(t.id, v)} onDel={() => onDelT(t.id)} />
        ))}
        {tarefas.length === 0 && <p className="text-xs text-slate-400 py-1">Nenhuma tarefa de implantação ainda.</p>}

        {pendente ? (
          <EscolhaDestino tarefa={pendente} onEscolher={escolher} onCancelar={() => setPendente(null)} />
        ) : abrindo ? (
          <div className="rounded-lg border border-teal-200 bg-white px-2 py-2 mt-1">
            <TarefaForm listId={listId} onSalvar={(v) => setPendente(v)} onCancelar={() => setAbrindo(false)} />
          </div>
        ) : (
          <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1 pt-1" onClick={() => setAbrindo(true)}><Plus className="w-3 h-3" /> tarefa de implantação</button>
        )}
      </div>
    </div>
  );
}

function AreaBlock({ areaId, areaNome, funcs, vereditoPorFunc, tarefasDaFunc, feitas, extraIds, listId, over, handleProps, rowProps, onReorderFuncs, onReorderTarefas, onAdd, onToggle, onSalvarT, onDelT }) {
  const dnd = useReorder(funcs.map((f) => f.id), onReorderFuncs);
  const horasArea = funcs.reduce((a, f) => a + tarefasDaFunc(f.id).reduce((s, t) => s + (Number(t.tempo) || 0), 0), 0);
  return (
    <div {...rowProps} className={`rounded-2xl border bg-white p-4 ${over ? "border-teal-400 ring-2 ring-teal-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Grip handleProps={handleProps} />
        <Layers className="w-4 h-4 text-teal-700" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-900 flex-1">{areaNome}</h2>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400"><Clock className="w-3 h-3" />{horas(horasArea)}</span>
        <span className="font-mono text-xs text-slate-400">{funcs.length} func.</span>
      </div>
      <div className="space-y-3">
        {funcs.map((f) => (
          <FuncBlock key={f.id} f={f} veredito={vereditoPorFunc[f.id]} tarefas={tarefasDaFunc(f.id)}
            feitas={feitas} extraIds={extraIds} listId={listId}
            over={dnd.overId === f.id} handleProps={dnd.handleProps(f.id)} rowProps={dnd.rowProps(f.id)}
            onReorderTarefas={(order) => onReorderTarefas(f.id, order)}
            onAdd={(v, destino) => onAdd(f.id, v, destino)}
            onToggle={onToggle} onSalvarT={onSalvarT} onDelT={onDelT} />
        ))}
      </div>
    </div>
  );
}

export default function PlanoProjeto({ base, saveBase, diag, saveDiag, selectedId, setSelectedId }) {
  const diags = (diag.diagnosticos || []).filter((x) => x.status !== "em_andamento").slice().reverse();
  const d = diags.find((x) => x.id === selectedId) || diags[0];

  const areaNome = (id) => (base.areas || []).find((a) => a.id === id)?.nome || "—";
  const funcById = (id) => (base.funcionalidades || []).find((f) => f.id === id);

  const planos = diag.planos || [];
  const plano = (d && planos.find((p) => p.diagnostico_id === d.id)) || null;

  const consultores = [...new Set([
    ...(base.tarefas || []).map((t) => t.consultor),
    ...planos.flatMap((p) => (p.tarefasExtras || []).map((t) => t.consultor)),
  ].filter(Boolean))];
  const listId = "consultores-list";

  if (!d) {
    return (
      <div className="max-w-3xl mx-auto">
        <SectionTitle sub="Agrupa as funcionalidades de um relatório por área de negócio e organiza as tarefas de implantação.">Plano de projeto</SectionTitle>
        <Empty icon={ClipboardList} title="Nenhum relatório concluído" hint="Rode um diagnóstico até o fim (aba Diagnóstico) para montar o plano de projeto." />
      </div>
    );
  }

  const tecnicas = (diag.respostas || []).filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
  const vereditoPorFunc = {};
  tecnicas.forEach((r) => {
    const o = (base.opcoes || []).find((x) => x.id === r.opcao_id);
    const p = (base.perguntas || []).find((x) => x.id === r.pergunta_id);
    const f = p && funcById(p.funcionalidade_id);
    if (f) vereditoPorFunc[f.id] = o?.veredito || "rever";
  });
  const funcsAvaliadas = Object.keys(vereditoPorFunc).map(funcById).filter(Boolean);

  const areasIds = [...new Set(funcsAvaliadas.map((f) => f.area_id))];
  const areasOrdenadas = orderedBy(plano?.ordemAreas, areasIds.map((id) => ({ id }))).map((x) => x.id);
  const funcsDaArea = (areaId) => orderedBy(plano?.ordemFuncs?.[areaId], funcsAvaliadas.filter((f) => f.area_id === areaId));

  const extras = plano?.tarefasExtras || [];
  const extraIds = new Set(extras.map((t) => t.id));
  const tarefasDaFunc = (funcId) => {
    const catalogo = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const doPlano = extras.filter((t) => t.funcionalidade_id === funcId);
    return orderedBy(plano?.ordemTarefas?.[funcId], [...catalogo, ...doPlano]);
  };

  const savePlano = (patch) => {
    const atual = plano || { id: uid(), diagnostico_id: d.id, ordemAreas: [], ordemFuncs: {}, ordemTarefas: {}, tarefasExtras: [], feitas: {} };
    saveDiag({ ...diag, planos: [...planos.filter((p) => p.diagnostico_id !== d.id), { ...atual, ...patch, atualizado_em: nowISO() }] });
  };
  const reorderAreas = (order) => savePlano({ ordemAreas: order });
  const reorderFuncs = (areaId, order) => savePlano({ ordemFuncs: { ...(plano?.ordemFuncs || {}), [areaId]: order } });
  const reorderTarefas = (funcId, order) => savePlano({ ordemTarefas: { ...(plano?.ordemTarefas || {}), [funcId]: order } });
  const toggleFeita = (tid) => savePlano({ feitas: { ...(plano?.feitas || {}), [tid]: !plano?.feitas?.[tid] } });

  const addTarefa = (funcId, v, destino) => {
    if (destino === "catalogo") {
      const ordem = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).length;
      saveBase({ ...base, tarefas: [...(base.tarefas || []), { id: uid(), funcionalidade_id: funcId, nome: v.nome, tempo: v.tempo, consultor: v.consultor, ordem, criado_em: nowISO() }] });
    } else if (destino === "curadoria") {
      saveBase({ ...base, tarefasSugeridas: [...(base.tarefasSugeridas || []), { id: uid(), funcionalidade_id: funcId, nome: v.nome, tempo: v.tempo, consultor: v.consultor, origem: "plano", criado_em: nowISO() }] });
    } else {
      savePlano({ tarefasExtras: [...extras, { id: uid(), funcionalidade_id: funcId, nome: v.nome, tempo: v.tempo, consultor: v.consultor, criado_em: nowISO() }] });
    }
  };
  const salvarTarefa = (tid, v) => {
    if (extraIds.has(tid)) savePlano({ tarefasExtras: extras.map((t) => t.id === tid ? { ...t, ...v } : t) });
    else saveBase({ ...base, tarefas: (base.tarefas || []).map((t) => t.id === tid ? { ...t, ...v } : t) });
  };
  const delTarefa = (tid) => {
    if (extraIds.has(tid)) savePlano({ tarefasExtras: extras.filter((t) => t.id !== tid) });
    else {
      if (!window.confirm("Esta tarefa é do catálogo da funcionalidade. Remover do catálogo (afeta os próximos relatórios)?")) return;
      saveBase({ ...base, tarefas: (base.tarefas || []).filter((t) => t.id !== tid) });
    }
  };

  const feitas = plano?.feitas || {};
  const todas = funcsAvaliadas.flatMap((f) => tarefasDaFunc(f.id));
  const total = todas.length;
  const feitasN = todas.filter((t) => feitas[t.id]).length;
  const pct = total ? Math.round((feitasN / total) * 100) : 0;
  const horasTotais = todas.reduce((a, t) => a + (Number(t.tempo) || 0), 0);

  const areasDnd = useReorder(areasOrdenadas, reorderAreas);

  return (
    <div className="max-w-3xl mx-auto">
      <datalist id={listId}>{consultores.map((c) => <option key={c} value={c} />)}</datalist>

      <SectionTitle sub="Agrupa as funcionalidades do relatório por área de negócio e organiza as tarefas de implantação. Arraste pela alça para reordenar áreas, funcionalidades e tarefas.">Plano de projeto</SectionTitle>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Relatório</span>
        <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
          {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono"><Clock className="w-3.5 h-3.5" />{horas(horasTotais)} totais</span>
          <span className="text-xs text-slate-400 font-mono">{feitasN}/{total}</span>
          <div className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} /></div>
          <span className="text-sm font-semibold text-teal-800 w-10 text-right">{pct}%</span>
        </div>
      </div>

      {areasOrdenadas.length === 0 && <Empty icon={ClipboardList} title="Este relatório não tem funcionalidades avaliadas" hint="Rode o diagnóstico técnico para gerar o plano." />}

      <div className="space-y-4">
        {areasOrdenadas.map((areaId) => (
          <AreaBlock key={areaId} areaId={areaId} areaNome={areaNome(areaId)}
            funcs={funcsDaArea(areaId)} vereditoPorFunc={vereditoPorFunc} tarefasDaFunc={tarefasDaFunc}
            feitas={feitas} extraIds={extraIds} listId={listId}
            over={areasDnd.overId === areaId} handleProps={areasDnd.handleProps(areaId)} rowProps={areasDnd.rowProps(areaId)}
            onReorderFuncs={(order) => reorderFuncs(areaId, order)}
            onReorderTarefas={reorderTarefas}
            onAdd={addTarefa} onToggle={toggleFeita} onSalvarT={salvarTarefa} onDelT={delTarefa} />
        ))}
      </div>
    </div>
  );
}
