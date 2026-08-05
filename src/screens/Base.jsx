import { Edit3, Trash2 } from "lucide-react";
import { VEREDITOS, SectionTitle } from "../ui.jsx";

export default function Base({ base, saveBase, onEdit }) {
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

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="O ativo que aprende. Cada funcionalidade é um tema com perguntas e vereditos curados.">Base de conhecimento</SectionTitle>
      {base.areas.map((a) => {
        const fs = base.funcionalidades.filter((f) => f.area_id === a.id);
        if (!fs.length) return null;
        return (
          <div key={a.id} className="mb-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-teal-700 mb-2">{a.nome} · {fs.length}</h3>
            <div className="space-y-2">
              {fs.map((f) => {
                const pgs = base.perguntas.filter((p) => p.funcionalidade_id === f.id);
                return (
                  <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{f.nome}</div>
                        <div className="font-mono text-xs text-slate-400">{f.codigo}</div>
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
                                <span className={`h-1.5 w-1.5 rounded-full ${VEREDITOS[o.veredito].dot}`} />{o.texto}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
