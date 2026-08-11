import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, ListChecks, Video, MapPin, CalendarDays } from "lucide-react";
import { fmtDate, AREAS_CONSULTORIA, Empty, SectionTitle } from "../ui.jsx";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MODO_LABEL = { remoto: "Remoto", inloco: "In-loco" };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

export default function Agenda({ base, diag, selectedId, setSelectedId }) {
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const [modo, setModo] = useState("plano"); // "plano" | "area"
  const [areaSel, setAreaSel] = useState(AREAS_CONSULTORIA[0]);
  const planoId = selectedId && diags.some((x) => x.id === selectedId) ? selectedId : diags[0]?.id;

  const hoje = new Date();
  const [cursor, setCursor] = useState({ y: hoje.getFullYear(), m: hoje.getMonth() });

  // Índice taskId -> metadados, para um diagnóstico.
  const indexTarefas = (d) => {
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const fids = new Set();
    rs.forEach((r) => {
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const fid = r.funcionalidade_id || p?.funcionalidade_id;
      if (fid) fids.add(fid);
    });
    const map = {};
    [...fids].forEach((fid) => {
      const f = base.funcionalidades.find((x) => x.id === fid);
      if (!f) return;
      (f.tarefas || []).forEach((t) => (map[t.id] = { nome: t.nome, area: t.area, funcNome: f.nome, horas: Number(t.horas) || 0 }));
    });
    (d.tarefasExtra || []).forEach((t) => {
      const f = t.funcId ? base.funcionalidades.find((x) => x.id === t.funcId) : null;
      map[t.id] = { nome: t.nome, area: t.area, funcNome: f ? f.nome : "Avulsa", horas: Number(t.horas) || 0 };
    });
    return map;
  };

  const eventos = useMemo(() => {
    const base_diags = modo === "plano" ? diags.filter((d) => d.id === planoId) : diags;
    const evs = [];
    base_diags.forEach((d) => {
      const idx = indexTarefas(d);
      Object.entries(d.planoAgenda || {}).forEach(([taskId, a]) => {
        if (!a || !a.data) return;
        const t = idx[taskId];
        if (!t) return;
        if (modo === "area" && t.area !== areaSel) return;
        evs.push({ diagId: d.id, taskId, clienteNome: d.cliente_nome, data: a.data, inicio: a.inicio, fim: a.fim, modo: a.modo, ...t });
      });
    });
    return evs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, planoId, areaSel, diag, base]);

  const porDia = useMemo(() => {
    const map = {};
    eventos.forEach((e) => { (map[e.data] = map[e.data] || []).push(e); });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.inicio || "99").localeCompare(b.inicio || "99")));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos]);

  // Monta as células do mês (semana começando no domingo).
  const celulas = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      cells.push(dt);
    }
    return cells;
  }, [cursor]);

  const irMes = (delta) => setCursor((c) => {
    const dt = new Date(c.y, c.m + delta, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const hojeStr = ymd(hoje);

  if (diags.length === 0) return (
    <div className="max-w-3xl mx-auto">
      <Empty icon={CalendarDays} title="Nenhum plano ainda" hint="Rode um diagnóstico, monte o plano e agende tarefas no Quadro para vê-las aqui." />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub="O que está agendado, por projeto ou por área de consultoria.">Agenda</SectionTitle>
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

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <span className="font-semibold text-slate-800">{MESES[cursor.m]} {cursor.y}</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setCursor({ y: hoje.getFullYear(), m: hoje.getMonth() })} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">Hoje</button>
            <button onClick={() => irMes(-1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => irMes(1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DIAS.map((d) => <div key={d} className="px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">{d}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {celulas.map((dt, i) => {
            const key = ymd(dt);
            const doMes = dt.getMonth() === cursor.m;
            const evs = porDia[key] || [];
            return (
              <div key={i} className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 align-top ${doMes ? "bg-white" : "bg-slate-50/60"}`}>
                <div className={`text-[11px] font-mono mb-1 ${key === hojeStr ? "inline-flex items-center justify-center h-5 w-5 rounded-full bg-teal-700 text-white" : doMes ? "text-slate-500" : "text-slate-300"}`}>{dt.getDate()}</div>
                <div className="space-y-1">
                  {evs.map((e) => (
                    <div key={e.diagId + e.taskId} title={`${e.nome}${e.inicio ? ` · ${e.inicio}${e.fim ? "–" + e.fim : ""}` : ""} · ${MODO_LABEL[e.modo] || ""} · ${modo === "area" ? e.clienteNome : e.funcNome}`}
                      className="rounded-md border border-teal-100 bg-teal-50 px-1.5 py-1 text-[10px] leading-tight text-teal-900">
                      <div className="flex items-center gap-1">
                        {e.modo === "inloco" ? <MapPin className="w-2.5 h-2.5 shrink-0" /> : <Video className="w-2.5 h-2.5 shrink-0" />}
                        {e.inicio && <span className="font-mono">{e.inicio}</span>}
                      </div>
                      <div className="truncate">{e.nome}</div>
                      <div className="truncate text-teal-700/70">{modo === "area" ? e.clienteNome : e.area}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5 text-teal-600" /> Remoto</span>
        <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-teal-600" /> In-loco</span>
        <span className="ml-auto">{eventos.length} agendamento(s) no recorte</span>
      </div>
    </div>
  );
}
