import { useState } from "react";
import { Edit3, Trash2, Filter, X } from "lucide-react";
import { VEREDITOS, SectionTitle } from "../ui.jsx";

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
