import { useState } from "react";
import { ClipboardList, ChevronUp, ChevronDown, Plus, Trash2, Check, X, PencilLine, Layers, Clock, User } from "lucide-react";
import { VEREDITOS, VeredictoChip, SectionTitle, Empty, uid, nowISO, fmtDate, inputCls, btnGhost } from "../ui.jsx";

/* Ordena `items` (com .id) conforme a lista de ids salva no plano.
   Ids não listados entram no fim, na ordem natural de entrada. */
function orderedBy(savedOrder, items) {
  const pos = new Map((savedOrder || []).map((id, i) => [id, i]));
  return items
    .map((it, i) => ({ it, k: pos.has(it.id) ? pos.get(it.id) : (savedOrder ? savedOrder.length + i : i) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it);
}

function moveInArray(ids, id, dir) {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const horas = (n) => `${Number(n) || 0}h`;

function MoveBtns({ canUp, canDown, onUp, onDown, titulo }) {
  return (
    <div className="flex flex-col shrink-0">
      <button title={`Subir ${titulo}`} onClick={onUp} disabled={!canUp}
        className="p-0.5 text-slate-400 hover:text-teal-700 disabled:opacity-25 disabled:hover:text-slate-400"><ChevronUp className="w-4 h-4" /></button>
      <button title={`Descer ${titulo}`} onClick={onDown} disabled={!canDown}
        className="p-0.5 text-slate-400 hover:text-teal-700 disabled:opacity-25 disabled:hover:text-slate-400"><ChevronDown className="w-4 h-4" /></button>
    </div>
  );
}

/* Formulário de tarefa (nome, tempo, consultor). Usado ao adicionar e ao editar. */
function TarefaForm({ inicial, consultores, listId, onSalvar, onCancelar, textoBotao = "Adicionar" }) {
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
      <input className={inputCls + " py-1 flex-1 min-w-[10rem]"} placeholder="Nome da tarefa" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={onKey} autoFocus={!!inicial} />
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <input type="number" min="0" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500" placeholder="h" value={tempo} onChange={(e) => setTempo(e.target.value)} onKeyDown={onKey} />
      </div>
      <div className="flex items-center gap-1">
        <User className="w-3.5 h-3.5 text-slate-400" />
        <input list={listId} className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500" placeholder="Consultor" value={consultor} onChange={(e) => setConsultor(e.target.value)} onKeyDown={onKey} />
      </div>
      <button className={btnGhost + " py-1.5"} onClick={salvar}><Check className="w-4 h-4" /> {textoBotao}</button>
      {onCancelar && <button className="p-1.5 text-slate-400 hover:text-red-600" onClick={onCancelar}><X className="w-4 h-4" /></button>}
    </div>
  );
}

function TarefaRow({ t, feita, extra, consultores, listId, canUp, canDown, onMove, onToggle, onSalvar, onDel }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <div className="rounded-lg border border-teal-200 bg-white px-2 py-2">
        <TarefaForm inicial={t} consultores={consultores} listId={listId} textoBotao="Salvar"
          onSalvar={(v) => { onSalvar(v); setEditando(false); }} onCancelar={() => setEditando(false)} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <MoveBtns titulo="tarefa" canUp={canUp} canDown={canDown} onUp={() => onMove("up")} onDown={() => onMove("down")} />
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

function FuncBlock({ f, veredito, tarefas, feitas, extraIds, consultores, listId, canUp, canDown, onMoveFunc, onMoveTarefa, onAdd, onToggle, onSalvarT, onDelT }) {
  const [abrindo, setAbrindo] = useState(false);
  const feitasN = tarefas.filter((t) => feitas[t.id]).length;
  const totalH = tarefas.reduce((a, t) => a + (Number(t.tempo) || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <MoveBtns titulo="funcionalidade" canUp={canUp} canDown={canDown} onUp={() => onMoveFunc("up")} onDown={() => onMoveFunc("down")} />
        <span className="font-medium text-slate-800 flex-1">{f.nome}</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400"><Clock className="w-3 h-3" />{horas(totalH)}</span>
        <span className="font-mono text-xs text-slate-400">{feitasN}/{tarefas.length}</span>
        <VeredictoChip v={veredito} />
      </div>
      <div className="space-y-1.5 pl-1">
        {tarefas.map((t, i) => (
          <TarefaRow key={t.id} t={t} feita={feitas[t.id]} extra={extraIds.has(t.id)}
            consultores={consultores} listId={listId}
            canUp={i > 0} canDown={i < tarefas.length - 1}
            onMove={(dir) => onMoveTarefa(t.id, dir)}
            onToggle={() => onToggle(t.id)}
            onSalvar={(v) => onSalvarT(t.id, v)}
            onDel={() => onDelT(t.id)} />
        ))}
        {tarefas.length === 0 && <p className="text-xs text-slate-400 py-1">Nenhuma tarefa de implantação ainda.</p>}
        {abrindo ? (
          <div className="rounded-lg border border-teal-200 bg-white px-2 py-2 mt-1">
            <TarefaForm consultores={consultores} listId={listId} onSalvar={(v) => onAdd(v)} onCancelar={() => setAbrindo(false)} />
          </div>
        ) : (
          <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1 pt-1" onClick={() => setAbrindo(true)}><Plus className="w-3 h-3" /> tarefa de implantação</button>
        )}
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

  // Consultores já usados (para o autocompletar)
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

  // Funcionalidades avaliadas + veredito
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

  // Tarefas de uma funcionalidade = catálogo (base.tarefas) + extras do plano
  const extras = plano?.tarefasExtras || [];
  const extraIds = new Set(extras.map((t) => t.id));
  const tarefasDaFunc = (funcId) => {
    const catalogo = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const doPlano = extras.filter((t) => t.funcionalidade_id === funcId);
    return orderedBy(plano?.ordemTarefas?.[funcId], [...catalogo, ...doPlano]);
  };

  // ---- persistência ----
  const savePlano = (patch) => {
    const atual = plano || { id: uid(), diagnostico_id: d.id, ordemAreas: [], ordemFuncs: {}, ordemTarefas: {}, tarefasExtras: [], feitas: {} };
    const novo = { ...atual, ...patch, atualizado_em: nowISO() };
    saveDiag({ ...diag, planos: [...planos.filter((p) => p.diagnostico_id !== d.id), novo] });
  };
  const moveArea = (areaId, dir) => savePlano({ ordemAreas: moveInArray(areasOrdenadas, areaId, dir) });
  const moveFunc = (areaId, funcId, dir) => savePlano({ ordemFuncs: { ...(plano?.ordemFuncs || {}), [areaId]: moveInArray(funcsDaArea(areaId).map((f) => f.id), funcId, dir) } });
  const moveTarefa = (funcId, tid, dir) => savePlano({ ordemTarefas: { ...(plano?.ordemTarefas || {}), [funcId]: moveInArray(tarefasDaFunc(funcId).map((t) => t.id), tid, dir) } });
  const toggleFeita = (tid) => savePlano({ feitas: { ...(plano?.feitas || {}), [tid]: !plano?.feitas?.[tid] } });

  // Adicionar tarefa: pergunta se vai também para o catálogo da funcionalidade.
  const addTarefa = (funcId, v) => {
    const noCatalogo = window.confirm(
      "Adicionar esta tarefa também ao catálogo da funcionalidade?\n\n" +
      "OK  → fica salva na funcionalidade e os próximos relatórios já trazem esta tarefa.\n" +
      "Cancelar → fica só neste plano de projeto."
    );
    if (noCatalogo) {
      const ordem = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).length;
      saveBase({ ...base, tarefas: [...(base.tarefas || []), { id: uid(), funcionalidade_id: funcId, nome: v.nome, tempo: v.tempo, consultor: v.consultor, ordem, criado_em: nowISO() }] });
    } else {
      savePlano({ tarefasExtras: [...extras, { id: uid(), funcionalidade_id: funcId, nome: v.nome, tempo: v.tempo, consultor: v.consultor, criado_em: nowISO() }] });
    }
  };
  const salvarTarefa = (tid, v) => {
    if (extraIds.has(tid)) {
      savePlano({ tarefasExtras: extras.map((t) => t.id === tid ? { ...t, ...v } : t) });
    } else {
      saveBase({ ...base, tarefas: (base.tarefas || []).map((t) => t.id === tid ? { ...t, ...v } : t) });
    }
  };
  const delTarefa = (tid) => {
    if (extraIds.has(tid)) {
      savePlano({ tarefasExtras: extras.filter((t) => t.id !== tid) });
    } else {
      if (!window.confirm("Esta tarefa é do catálogo da funcionalidade. Remover do catálogo (afeta os próximos relatórios)?")) return;
      saveBase({ ...base, tarefas: (base.tarefas || []).filter((t) => t.id !== tid) });
    }
  };

  // ---- totais ----
  const feitas = plano?.feitas || {};
  const todas = funcsAvaliadas.flatMap((f) => tarefasDaFunc(f.id));
  const total = todas.length;
  const feitasN = todas.filter((t) => feitas[t.id]).length;
  const pct = total ? Math.round((feitasN / total) * 100) : 0;
  const horasTotais = todas.reduce((a, t) => a + (Number(t.tempo) || 0), 0);

  return (
    <div className="max-w-3xl mx-auto">
      <datalist id={listId}>{consultores.map((c) => <option key={c} value={c} />)}</datalist>

      <SectionTitle sub="Agrupa as funcionalidades do relatório por área de negócio e organiza as tarefas de implantação. Reordene áreas, funcionalidades e tarefas com as setas.">Plano de projeto</SectionTitle>

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
        {areasOrdenadas.map((areaId, ai) => {
          const funcs = funcsDaArea(areaId);
          const horasArea = funcs.reduce((a, f) => a + tarefasDaFunc(f.id).reduce((s, t) => s + (Number(t.tempo) || 0), 0), 0);
          return (
            <div key={areaId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <MoveBtns titulo="área" canUp={ai > 0} canDown={ai < areasOrdenadas.length - 1} onUp={() => moveArea(areaId, "up")} onDown={() => moveArea(areaId, "down")} />
                <Layers className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-900 flex-1">{areaNome(areaId)}</h2>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400"><Clock className="w-3 h-3" />{horas(horasArea)}</span>
                <span className="font-mono text-xs text-slate-400">{funcs.length} func.</span>
              </div>
              <div className="space-y-3">
                {funcs.map((f, fi) => (
                  <FuncBlock key={f.id} f={f} veredito={vereditoPorFunc[f.id]}
                    tarefas={tarefasDaFunc(f.id)} feitas={feitas} extraIds={extraIds}
                    consultores={consultores} listId={listId}
                    canUp={fi > 0} canDown={fi < funcs.length - 1}
                    onMoveFunc={(dir) => moveFunc(areaId, f.id, dir)}
                    onMoveTarefa={(tid, dir) => moveTarefa(f.id, tid, dir)}
                    onAdd={(v) => addTarefa(f.id, v)}
                    onToggle={toggleFeita}
                    onSalvarT={salvarTarefa}
                    onDelT={delTarefa} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
