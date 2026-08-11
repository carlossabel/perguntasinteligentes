import { useState, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, ListChecks, X, Video, MapPin, Calendar, Check } from "lucide-react";
import { fmtDate, AREAS_CONSULTORIA, btnTeal, Empty, SectionTitle } from "../ui.jsx";

const FASES = [
  { id: "backlog", label: "Backlog" },
  { id: "agendado", label: "Agendado" },
  { id: "execucao", label: "Em execução" },
  { id: "aguardando", label: "Aguardando" },
  { id: "concluido", label: "Concluído" },
];
const FASE_DEFAULT = "backlog";
const AGENDADO = "agendado";
const faseIdx = (id) => Math.max(0, FASES.findIndex((f) => f.id === id));
const MODO_LABEL = { remoto: "Remoto", inloco: "In-loco" };
const fmtData = (s) => { if (!s) return ""; const p = s.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}` : s; };

export default function Kanban({ base, diag, saveDiag, selectedId, setSelectedId }) {
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const [modo, setModo] = useState("plano"); // "plano" | "area"
  const [areaSel, setAreaSel] = useState(AREAS_CONSULTORIA[0]);
  const planoId = selectedId && diags.some((x) => x.id === selectedId) ? selectedId : diags[0]?.id;

  // Coleta as tarefas de um diagnóstico (funcionalidades presentes + avulsas), já com a fase.
  const tarefasDoDiag = (d) => {
    if (!d) return [];
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const fids = new Set();
    rs.forEach((r) => {
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const fid = r.funcionalidade_id || p?.funcionalidade_id;
      if (fid) fids.add(fid);
    });
    const fases = d.planoFases || {};
    const ag = d.planoAgenda || {};
    const items = [];
    [...fids].forEach((fid) => {
      const f = base.funcionalidades.find((x) => x.id === fid);
      if (!f) return;
      (f.tarefas || []).forEach((t) => items.push({
        key: `${d.id}::${t.id}`, diagId: d.id, taskId: t.id, clienteNome: d.cliente_nome,
        nome: t.nome, horas: Number(t.horas) || 0, area: t.area, funcNome: f.nome, fase: fases[t.id] || FASE_DEFAULT, agenda: ag[t.id] || null,
      }));
    });
    (d.tarefasExtra || []).forEach((t) => {
      const f = t.funcId ? base.funcionalidades.find((x) => x.id === t.funcId) : null;
      items.push({
        key: `${d.id}::${t.id}`, diagId: d.id, taskId: t.id, clienteNome: d.cliente_nome,
        nome: t.nome, horas: Number(t.horas) || 0, area: t.area, funcNome: f ? f.nome : "Avulsa", extra: true, fase: fases[t.id] || FASE_DEFAULT, agenda: ag[t.id] || null,
      });
    });
    return items;
  };

  const cards = useMemo(() => {
    if (modo === "plano") return tarefasDoDiag(diag.diagnosticos.find((x) => x.id === planoId));
    return diags.flatMap((d) => tarefasDoDiag(d)).filter((c) => c.area === areaSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, planoId, areaSel, diag, base]);

  const porFase = (fid) => cards.filter((c) => c.fase === fid);
  const horas = (arr) => arr.reduce((s, c) => s + c.horas, 0);

  const mover = (diagId, taskId, fase) => {
    const diagnosticos = diag.diagnosticos.map((x) => x.id === diagId ? { ...x, planoFases: { ...(x.planoFases || {}), [taskId]: fase } } : x);
    saveDiag && saveDiag({ ...diag, diagnosticos });
  };
  const moverRel = (c, dir) => {
    const i = faseIdx(c.fase) + dir;
    if (i < 0 || i >= FASES.length) return;
    if (FASES[i].id === AGENDADO) return abrirAgenda(c);
    mover(c.diagId, c.taskId, FASES[i].id);
  };

  // ---- Agendamento (ao entrar em "Agendado") ----
  const [agendaModal, setAgendaModal] = useState(null); // { card, data, inicio, fim, modo }
  const [agendaErro, setAgendaErro] = useState("");
  const abrirAgenda = (card) => {
    const dx = diag.diagnosticos.find((x) => x.id === card.diagId);
    const a = (dx?.planoAgenda || {})[card.taskId] || {};
    setAgendaModal({ card, data: a.data || "", inicio: a.inicio || "", fim: a.fim || "", modo: a.modo || "remoto" });
    setAgendaErro("");
  };
  const confirmarAgenda = () => {
    const m = agendaModal; if (!m) return;
    if (!m.data) return setAgendaErro("Informe a data.");
    if (m.inicio && m.fim && m.fim <= m.inicio) return setAgendaErro("O horário fim deve ser depois do início.");
    const diagnosticos = diag.diagnosticos.map((x) => x.id === m.card.diagId ? {
      ...x,
      planoFases: { ...(x.planoFases || {}), [m.card.taskId]: AGENDADO },
      planoAgenda: { ...(x.planoAgenda || {}), [m.card.taskId]: { data: m.data, inicio: m.inicio, fim: m.fim, modo: m.modo } },
    } : x);
    saveDiag && saveDiag({ ...diag, diagnosticos });
    setAgendaModal(null);
  };

  const dragCard = useRef(null);
  const [overFase, setOverFase] = useState(null);
  const onDrop = (faseId) => {
    const src = dragCard.current; dragCard.current = null; setOverFase(null);
    if (!src || src.fase === faseId) return;
    if (faseId === AGENDADO) return abrirAgenda(src);
    mover(src.diagId, src.taskId, faseId);
  };

  if (diags.length === 0) return (
    <div className="max-w-3xl mx-auto">
      <Empty icon={LayoutGrid} title="Nenhum plano ainda" hint="Rode um diagnóstico e monte o plano de projeto para acompanhar as tarefas aqui." />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub="Acompanhe a execução das tarefas do plano de projeto por fase.">Quadro de atividades</SectionTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            <button onClick={() => setModo("plano")} className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${modo === "plano" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}><ListChecks className="w-4 h-4" /> Por plano</button>
            <button onClick={() => setModo("area")} className={`px-3 py-1.5 inline-flex items-center gap-1.5 border-l border-slate-300 ${modo === "area" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}><LayoutGrid className="w-4 h-4" /> Por área</button>
          </div>
          {modo === "plano" ? (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-xs" value={planoId || ""} onChange={(e) => setSelectedId && setSelectedId(e.target.value)}>
              {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
            </select>
          ) : (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={areaSel} onChange={(e) => setAreaSel(e.target.value)}>
              {AREAS_CONSULTORIA.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <Empty icon={LayoutGrid} title="Nenhuma tarefa neste recorte"
          hint={modo === "plano" ? "Este plano ainda não tem tarefas. Adicione tarefas no Plano de projeto." : "Nenhuma tarefa desta área de consultoria nos planos existentes."} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {FASES.map((f) => {
            const lista = porFase(f.id);
            return (
              <div key={f.id} onDragOver={(e) => { e.preventDefault(); setOverFase(f.id); }} onDragLeave={() => setOverFase((o) => (o === f.id ? null : o))} onDrop={() => onDrop(f.id)}
                className={`shrink-0 w-[240px] rounded-2xl border p-2.5 ${overFase === f.id ? "border-teal-400 bg-teal-50/40" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center gap-2 px-1.5 pb-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{f.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-400">{lista.length} · {horas(lista)} h</span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {lista.map((c) => {
                    const i = faseIdx(c.fase);
                    return (
                      <div key={c.key} draggable onDragStart={() => { dragCard.current = c; }}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 cursor-grab active:cursor-grabbing shadow-sm">
                        <div className="text-sm text-slate-800 leading-snug">{c.nome}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">{c.area}</span>
                          <span className="font-mono text-[11px] text-slate-400">{c.horas} h</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-1">{modo === "area" ? c.clienteNome : c.funcNome}</div>
                        {c.agenda && c.agenda.data && (
                          <button onClick={() => abrirAgenda(c)} title="Editar agendamento"
                            className="w-full mt-1.5 flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-100 px-2 py-1 text-[11px] text-teal-800 hover:bg-teal-100">
                            {c.agenda.modo === "inloco" ? <MapPin className="w-3 h-3 shrink-0" /> : <Video className="w-3 h-3 shrink-0" />}
                            <span className="font-mono">{fmtData(c.agenda.data)}{c.agenda.inicio ? ` · ${c.agenda.inicio}` : ""}{c.agenda.fim ? `–${c.agenda.fim}` : ""}</span>
                            <span className="ml-auto uppercase tracking-wider text-[9px]">{MODO_LABEL[c.agenda.modo] || ""}</span>
                          </button>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <button disabled={i === 0} onClick={() => moverRel(c, -1)} title="Fase anterior"
                            className="p-1 text-slate-300 enabled:hover:text-teal-600 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{FASES[i].label}</span>
                          <button disabled={i === FASES.length - 1} onClick={() => moverRel(c, 1)} title="Próxima fase"
                            className="p-1 text-slate-300 enabled:hover:text-teal-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {agendaModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setAgendaModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-teal-700" />
              <h3 className="font-semibold text-slate-800">Agendar tarefa</h3>
              <button className="ml-auto text-slate-400 hover:text-slate-700" onClick={() => setAgendaModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-3 truncate">{agendaModal.card.nome}</p>

            <label className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Data</label>
            <input type="date" className="w-full mt-1 mb-3 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              value={agendaModal.data} onChange={(e) => setAgendaModal((m) => ({ ...m, data: e.target.value }))} />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Início</label>
                <input type="time" className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  value={agendaModal.inicio} onChange={(e) => setAgendaModal((m) => ({ ...m, inicio: e.target.value }))} />
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Fim</label>
                <input type="time" className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  value={agendaModal.fim} onChange={(e) => setAgendaModal((m) => ({ ...m, fim: e.target.value }))} />
              </div>
            </div>

            <label className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Modalidade</label>
            <div className="grid grid-cols-2 gap-2 mt-1 mb-4">
              <button onClick={() => setAgendaModal((m) => ({ ...m, modo: "remoto" }))}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${agendaModal.modo === "remoto" ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}><Video className="w-4 h-4" /> Remoto</button>
              <button onClick={() => setAgendaModal((m) => ({ ...m, modo: "inloco" }))}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${agendaModal.modo === "inloco" ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}><MapPin className="w-4 h-4" /> In-loco</button>
            </div>

            {agendaErro && <p className="text-xs text-red-600 mb-2">{agendaErro}</p>}
            <div className="flex items-center gap-2">
              <button className={btnTeal} onClick={confirmarAgenda}><Check className="w-4 h-4" /> Agendar</button>
              <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setAgendaModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
