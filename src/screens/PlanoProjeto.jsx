import { useState } from "react";
import { ClipboardList, ChevronUp, ChevronDown, Plus, Trash2, Check, X, PencilLine, Layers } from "lucide-react";
import { VEREDITOS, VeredictoChip, SectionTitle, Empty, uid, nowISO, fmtDate, inputCls, btnGhost } from "../ui.jsx";

/* Ordena `items` (com .id) conforme a lista de ids salva no plano.
   Ids não listados entram no fim, na ordem natural de entrada. */
function orderedBy(savedOrder, items) {
  const pos = new Map((savedOrder || []).map((id, i) => [id, i]));
  return items
    .map((it, i) => ({ it, k: pos.has(it.id) ? pos.get(it.id) : savedOrder ? savedOrder.length + i : i }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it);
}

/* Troca um id de posição (up/down) numa lista de ids. */
function moveInArray(ids, id, dir) {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* Botõezinhos de mover (↑ ↓) reaproveitados em cada nível. */
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

/* Uma linha de tarefa: checkbox (feita), texto editável, mover, remover. */
function TarefaRow({ t, feita, canUp, canDown, onMove, onToggle, onSave, onDel }) {
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(t.texto);
  const salvar = () => { if (txt.trim()) onSave(txt); setEditing(false); };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <MoveBtns titulo="tarefa" canUp={canUp} canDown={canDown} onUp={() => onMove("up")} onDown={() => onMove("down")} />
      <input type="checkbox" checked={!!feita} onChange={onToggle}
        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
      {editing ? (
        <input autoFocus className={inputCls + " py-1"} value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") { setTxt(t.texto); setEditing(false); } }} />
      ) : (
        <span className={`flex-1 text-sm ${feita ? "line-through text-slate-400" : "text-slate-700"}`}>{t.texto}</span>
      )}
      {editing ? (
        <button className="p-1 text-teal-700 hover:text-teal-900" onClick={salvar}><Check className="w-4 h-4" /></button>
      ) : (
        <button className="p-1 text-slate-300 hover:text-teal-700" onClick={() => { setTxt(t.texto); setEditing(true); }}><PencilLine className="w-4 h-4" /></button>
      )}
      <button className="p-1 text-slate-300 hover:text-red-600" onClick={onDel}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

/* Bloco de uma funcionalidade dentro da área: veredito, mover, tarefas e "+ tarefa". */
function FuncBlock({ f, veredito, tarefas, feitas, canUp, canDown, onMoveFunc, onMoveTarefa, onAdd, onToggle, onSaveT, onDelT }) {
  const [nova, setNova] = useState("");
  const add = () => { if (nova.trim()) { onAdd(nova); setNova(""); } };
  const feitasN = tarefas.filter((t) => feitas[t.id]).length;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <MoveBtns titulo="funcionalidade" canUp={canUp} canDown={canDown} onUp={() => onMoveFunc("up")} onDown={() => onMoveFunc("down")} />
        <span className="font-medium text-slate-800 flex-1">{f.nome}</span>
        <span className="font-mono text-xs text-slate-400">{feitasN}/{tarefas.length}</span>
        <VeredictoChip v={veredito} />
      </div>
      <div className="space-y-1.5 pl-1">
        {tarefas.map((t, i) => (
          <TarefaRow key={t.id} t={t} feita={feitas[t.id]}
            canUp={i > 0} canDown={i < tarefas.length - 1}
            onMove={(dir) => onMoveTarefa(t.id, dir)}
            onToggle={() => onToggle(t.id)}
            onSave={(txt) => onSaveT(t.id, txt)}
            onDel={() => onDelT(t.id)} />
        ))}
        {tarefas.length === 0 && <p className="text-xs text-slate-400 py-1">Nenhuma tarefa de implantação ainda.</p>}
        <div className="flex items-center gap-2 pt-1">
          <input className={inputCls + " py-1"} placeholder="+ nova tarefa de implantação" value={nova}
            onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className={btnGhost + " py-1.5"} onClick={add}><Plus className="w-4 h-4" /></button>
        </div>
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

  if (!d) {
    return (
      <div className="max-w-3xl mx-auto">
        <SectionTitle sub="Agrupa as funcionalidades de um relatório por área de negócio e organiza as tarefas de implantação.">Plano de projeto</SectionTitle>
        <Empty icon={ClipboardList} title="Nenhum relatório concluído" hint="Rode um diagnóstico até o fim (aba Diagnóstico) para montar o plano de projeto." />
      </div>
    );
  }

  // Funcionalidades avaliadas no diagnóstico + o veredito de cada uma
  const tecnicas = (diag.respostas || []).filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
  const vereditoPorFunc = {};
  tecnicas.forEach((r) => {
    const o = (base.opcoes || []).find((x) => x.id === r.opcao_id);
    const p = (base.perguntas || []).find((x) => x.id === r.pergunta_id);
    const f = p && funcById(p.funcionalidade_id);
    if (f) vereditoPorFunc[f.id] = o?.veredito || "rever";
  });
  const funcsAvaliadas = Object.keys(vereditoPorFunc).map(funcById).filter(Boolean);

  // Agrupamento por área (ordenado pelo plano)
  const areasIds = [...new Set(funcsAvaliadas.map((f) => f.area_id))];
  const areasOrdenadas = orderedBy(plano?.ordemAreas, areasIds.map((id) => ({ id }))).map((x) => x.id);

  const funcsDaArea = (areaId) =>
    orderedBy(plano?.ordemFuncs?.[areaId], funcsAvaliadas.filter((f) => f.area_id === areaId));

  const tarefasDaFunc = (funcId) => {
    const list = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId)
      .slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return orderedBy(plano?.ordemTarefas?.[funcId], list);
  };

  // -------- persistência --------
  const savePlano = (patch) => {
    const atual = plano || { id: uid(), diagnostico_id: d.id, ordemAreas: [], ordemFuncs: {}, ordemTarefas: {}, feitas: {} };
    const novo = { ...atual, ...patch, atualizado_em: nowISO() };
    saveDiag({ ...diag, planos: [...planos.filter((p) => p.diagnostico_id !== d.id), novo] });
  };
  const moveArea = (areaId, dir) => savePlano({ ordemAreas: moveInArray(areasOrdenadas, areaId, dir) });
  const moveFunc = (areaId, funcId, dir) =>
    savePlano({ ordemFuncs: { ...(plano?.ordemFuncs || {}), [areaId]: moveInArray(funcsDaArea(areaId).map((f) => f.id), funcId, dir) } });
  const moveTarefa = (funcId, tid, dir) =>
    savePlano({ ordemTarefas: { ...(plano?.ordemTarefas || {}), [funcId]: moveInArray(tarefasDaFunc(funcId).map((t) => t.id), tid, dir) } });
  const toggleFeita = (tid) => savePlano({ feitas: { ...(plano?.feitas || {}), [tid]: !plano?.feitas?.[tid] } });

  const addTarefa = (funcId, texto) => {
    const ordem = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).length;
    saveBase({ ...base, tarefas: [...(base.tarefas || []), { id: uid(), funcionalidade_id: funcId, texto: texto.trim(), ordem, criado_em: nowISO() }] });
  };
  const updTarefa = (tid, texto) => saveBase({ ...base, tarefas: (base.tarefas || []).map((t) => t.id === tid ? { ...t, texto: texto.trim() } : t) });
  const delTarefa = (tid) => saveBase({ ...base, tarefas: (base.tarefas || []).filter((t) => t.id !== tid) });

  // -------- progresso --------
  const feitas = plano?.feitas || {};
  const todas = funcsAvaliadas.flatMap((f) => tarefasDaFunc(f.id));
  const total = todas.length;
  const feitasN = todas.filter((t) => feitas[t.id]).length;
  const pct = total ? Math.round((feitasN / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="Agrupa as funcionalidades do relatório por área de negócio e organiza as tarefas de implantação. Reordene áreas, funcionalidades e tarefas com as setas.">Plano de projeto</SectionTitle>

      {/* Seletor de relatório */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Relatório</span>
        <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
          {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">{feitasN}/{total} tarefas</span>
          <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold text-teal-800 w-10 text-right">{pct}%</span>
        </div>
      </div>

      {areasOrdenadas.length === 0 && (
        <Empty icon={ClipboardList} title="Este relatório não tem funcionalidades avaliadas" hint="Rode o diagnóstico técnico para gerar o plano." />
      )}

      <div className="space-y-4">
        {areasOrdenadas.map((areaId, ai) => {
          const funcs = funcsDaArea(areaId);
          return (
            <div key={areaId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <MoveBtns titulo="área" canUp={ai > 0} canDown={ai < areasOrdenadas.length - 1}
                  onUp={() => moveArea(areaId, "up")} onDown={() => moveArea(areaId, "down")} />
                <Layers className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-900 flex-1">{areaNome(areaId)}</h2>
                <span className="font-mono text-xs text-slate-400">{funcs.length} func.</span>
              </div>
              <div className="space-y-3">
                {funcs.map((f, fi) => (
                  <FuncBlock key={f.id} f={f} veredito={vereditoPorFunc[f.id]}
                    tarefas={tarefasDaFunc(f.id)} feitas={feitas}
                    canUp={fi > 0} canDown={fi < funcs.length - 1}
                    onMoveFunc={(dir) => moveFunc(areaId, f.id, dir)}
                    onMoveTarefa={(tid, dir) => moveTarefa(f.id, tid, dir)}
                    onAdd={(txt) => addTarefa(f.id, txt)}
                    onToggle={toggleFeita}
                    onSaveT={updTarefa}
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
