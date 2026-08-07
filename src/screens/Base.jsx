import { useState } from "react";
import { Edit3, Trash2, Filter, X, Plus, Check, ChevronUp, ChevronDown, PencilLine, Clock, User, ListTodo } from "lucide-react";
import { VEREDITOS, SectionTitle, uid, nowISO, inputCls, btnGhost } from "../ui.jsx";

const horas = (n) => `${Number(n) || 0}h`;

/* Editor do catálogo de tarefas de implantação de UMA funcionalidade (base.tarefas). */
function TarefasFunc({ base, saveBase, funcId }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tempo, setTempo] = useState("");
  const [consultor, setConsultor] = useState("");
  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState({ nome: "", tempo: "", consultor: "" });

  const tarefas = (base.tarefas || []).filter((t) => t.funcionalidade_id === funcId).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const consultores = [...new Set((base.tarefas || []).map((t) => t.consultor).filter(Boolean))];
  const listId = "consultores-base";
  const totalH = tarefas.reduce((a, t) => a + (Number(t.tempo) || 0), 0);

  const persist = (arr) => {
    const outras = (base.tarefas || []).filter((t) => t.funcionalidade_id !== funcId);
    saveBase({ ...base, tarefas: [...outras, ...arr.map((t, i) => ({ ...t, ordem: i }))] });
  };
  const add = () => {
    if (!nome.trim()) return;
    persist([...tarefas, { id: uid(), funcionalidade_id: funcId, nome: nome.trim(), tempo: Number(tempo) || 0, consultor: consultor.trim(), criado_em: nowISO() }]);
    setNome(""); setTempo(""); setConsultor("");
  };
  const salvarEd = () => {
    if (!ed.nome.trim()) return;
    persist(tarefas.map((t) => t.id === editId ? { ...t, nome: ed.nome.trim(), tempo: Number(ed.tempo) || 0, consultor: ed.consultor.trim() } : t));
    setEditId(null);
  };
  const remover = (id) => persist(tarefas.filter((t) => t.id !== id));
  const mover = (id, dir) => {
    const i = tarefas.findIndex((t) => t.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= tarefas.length) return;
    const arr = [...tarefas]; [arr[i], arr[j]] = [arr[j], arr[i]]; persist(arr);
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
      <button className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-teal-700" onClick={() => setAberto((v) => !v)}>
        <ListTodo className="w-3.5 h-3.5" /> Tarefas de implantação
        <span className="text-slate-400">· {tarefas.length}{totalH ? ` · ${horas(totalH)}` : ""}</span>
        {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {aberto && (
        <div className="mt-2 space-y-1.5">
          <datalist id={listId}>{consultores.map((c) => <option key={c} value={c} />)}</datalist>
          {tarefas.map((t, i) => editId === t.id ? (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 px-2 py-1.5">
              <input className={inputCls + " py-1 flex-1 min-w-[9rem]"} value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
              <input type="number" min="0" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm" value={ed.tempo} onChange={(e) => setEd({ ...ed, tempo: e.target.value })} />
              <input list={listId} className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm" value={ed.consultor} onChange={(e) => setEd({ ...ed, consultor: e.target.value })} />
              <button className="p-1 text-teal-700" onClick={salvarEd}><Check className="w-4 h-4" /></button>
              <button className="p-1 text-slate-400 hover:text-red-600" onClick={() => setEditId(null)}><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
              <div className="flex flex-col">
                <button className="p-0.5 text-slate-400 hover:text-teal-700 disabled:opacity-25" disabled={i === 0} onClick={() => mover(t.id, "up")}><ChevronUp className="w-4 h-4" /></button>
                <button className="p-0.5 text-slate-400 hover:text-teal-700 disabled:opacity-25" disabled={i === tarefas.length - 1} onClick={() => mover(t.id, "down")}><ChevronDown className="w-4 h-4" /></button>
              </div>
              <span className="flex-1 text-sm text-slate-700">{t.nome}</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono"><Clock className="w-3 h-3" />{horas(t.tempo)}</span>
              {t.consultor && <span className="inline-flex items-center gap-1 text-xs text-slate-500 max-w-[9rem] truncate"><User className="w-3 h-3" />{t.consultor}</span>}
              <button className="p-1 text-slate-300 hover:text-teal-700" onClick={() => { setEditId(t.id); setEd({ nome: t.nome, tempo: t.tempo ?? "", consultor: t.consultor || "" }); }}><PencilLine className="w-4 h-4" /></button>
              <button className="p-1 text-slate-300 hover:text-red-600" onClick={() => remover(t.id)}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {tarefas.length === 0 && <p className="text-xs text-slate-400">Nenhuma tarefa cadastrada para esta funcionalidade.</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input className={inputCls + " py-1 flex-1 min-w-[9rem]"} placeholder="Nome da tarefa" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /><input type="number" min="0" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm" placeholder="h" value={tempo} onChange={(e) => setTempo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
            <div className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /><input list={listId} className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-sm" placeholder="Consultor" value={consultor} onChange={(e) => setConsultor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
            <button className={btnGhost + " py-1.5"} onClick={add}><Plus className="w-4 h-4" /> tarefa</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Base({ base, saveBase, onEdit }) {
  const segmentos = base.segmentos || [];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const segNome = (id) => segmentos.find((s) => s.id === id)?.nome || "—";

  const del = (fid) => {
    if (!confirm("Remover esta funcionalidade e suas perguntas?")) return;
    const pids = base.perguntas.filter((p) => p.funcionalidade_id === fid).map((p) => p.id);
    saveBase({
      ...base,
      funcionalidades: base.funcionalidades.filter((f) => f.id !== fid),
      perguntas: base.perguntas.filter((p) => p.funcionalidade_id !== fid),
      opcoes: base.opcoes.filter((o) => !pids.includes(o.pergunta_id)),
    });
  };

  const segsDaFunc = (f) => (f.segmento_ids || []).map(segNome).join(" · ");

  const cardFunc = (f) => {
    const pgs = base.perguntas.filter((p) => p.funcionalidade_id === f.id);
    return (
      <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="font-medium text-slate-900">{f.nome}</div>
            <div className="font-mono text-xs text-slate-400">{areaNome(f.area_id)} · {segsDaFunc(f)}</div>
          </div>
          <div className="flex gap-1">
            <button className="p-1.5 text-slate-400 hover:text-teal-700" onClick={() => onEdit(f.id)}><Edit3 className="w-4 h-4" /></button>
            <button className="p-1.5 text-slate-400 hover:text-red-600" onClick={() => del(f.id)}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {pgs.map((p) => {
          const ops = base.opcoes.filter((o) => o.pergunta_id === p.id).sort((x, y) => x.ordem - y.ordem);
          return (
            <div key={p.id} className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm text-slate-700">{p.texto}</span>
                <span className={`font-mono text-xs uppercase px-1.5 py-0.5 rounded ${p.status === "aprovada" ? "bg-emerald-100 text-emerald-700" : p.status === "recusada" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500"}`}>{p.status}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {ops.map((o) => (
                  <span key={o.id} className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${(VEREDITOS[o.veredito] || VEREDITOS.rever).dot}`} />{o.texto}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <TarefasFunc base={base} saveBase={saveBase} funcId={f.id} />
      </div>
    );
  };

  const [fSeg, setFSeg] = useState("");
  const [fArea, setFArea] = useState("");

  const passaArea = (f) => fArea === "" || f.area_id === fArea;
  const passaSeg = (f) => fSeg === "" || (f.segmento_ids || []).includes(fSeg);

  // Áreas relevantes para o dropdown (que têm funcionalidade no segmento filtrado)
  const areasRelevantes = base.areas.filter((a) =>
    base.funcionalidades.some((f) => f.area_id === a.id && passaSeg(f))
  );

  const totalFuncs = base.funcionalidades.length;
  const mostradas = base.funcionalidades.filter((f) => passaSeg(f) && passaArea(f)).length;
  const filtroAtivo = fSeg !== "" || fArea !== "";
  const limpar = () => { setFSeg(""); setFArea(""); };

  const semSegmento = base.funcionalidades.filter((f) => !(f.segmento_ids || []).length && passaArea(f));

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="O ativo que aprende. Funcionalidades transversais, vinculadas a um ou mais segmentos. Área é global.">Base de conhecimento</SectionTitle>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-slate-400 mb-2"><Filter className="w-4 h-4" /><span className="font-mono text-xs uppercase tracking-widest">Filtrar</span></div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Segmento</label>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={fSeg} onChange={(e) => { setFSeg(e.target.value); setFArea(""); }}>
            <option value="">Todos</option>
            {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Área</label>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={fArea} onChange={(e) => setFArea(e.target.value)}>
            <option value="">Todas</option>
            {areasRelevantes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">{mostradas} de {totalFuncs}</span>
          {filtroAtivo && <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={limpar}><X className="w-3 h-3" /> limpar</button>}
        </div>
      </div>

      {mostradas === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhuma funcionalidade para esse filtro.</p>}

      {segmentos.filter((s) => fSeg === "" || s.id === fSeg).map((s) => {
        const funcs = base.funcionalidades.filter((f) => (f.segmento_ids || []).includes(s.id) && passaArea(f));
        if (!funcs.length) return null;
        const porArea = {};
        funcs.forEach((f) => { (porArea[f.area_id] = porArea[f.area_id] || []).push(f); });
        return (
          <div key={s.id} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-900">{s.nome}</h2>
              <span className="font-mono text-xs text-slate-400">{funcs.length} func.</span>
            </div>
            {Object.entries(porArea).map(([aid, fs]) => (
              <div key={aid} className="mb-5 pl-3 border-l-2 border-slate-200">
                <h3 className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-2">{areaNome(aid)} · {fs.length}</h3>
                <div className="space-y-2">{fs.map(cardFunc)}</div>
              </div>
            ))}
          </div>
        );
      })}
      {fSeg === "" && semSegmento.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">Sem segmento</h2>
            <span className="font-mono text-xs text-slate-400">{semSegmento.length} func.</span>
          </div>
          <div className="space-y-2">{semSegmento.map(cardFunc)}</div>
        </div>
      )}
    </div>
  );
}
