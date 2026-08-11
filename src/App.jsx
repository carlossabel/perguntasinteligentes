import { useState, useEffect } from "react";
import { Sparkles, ClipboardCheck, MessageSquare, FileText, Database, Gauge, Loader2, AlertTriangle, ListChecks, LayoutGrid, CalendarDays, Menu, X, Sun, Moon } from "lucide-react";
import { getBase, putBase, getDiag, putDiag } from "./api.js";
import Assessment from "./screens/Assessment.jsx";
import Cadastro from "./screens/Cadastro.jsx";
import Curadoria from "./screens/Curadoria.jsx";
import Diagnostico from "./screens/Diagnostico.jsx";
import Relatorio from "./screens/Relatorio.jsx";
import PlanoProjeto from "./screens/PlanoProjeto.jsx";
import Kanban from "./screens/Kanban.jsx";
import Agenda from "./screens/Agenda.jsx";
import Base from "./screens/Base.jsx";

const TABS = [
  { id: "diagnostico", label: "Rodar diagnóstico", icon: MessageSquare },
  { id: "assessment", label: "Cadastro de diagnóstico", icon: Gauge },
  { id: "cadastro", label: "Perguntas funcionalidade", icon: Sparkles },
  { id: "relatorio", label: "Pré-relatório", icon: FileText },
  { id: "plano", label: "Plano de projeto", icon: ListChecks },
  { id: "kanban", label: "Quadro (Kanban)", icon: LayoutGrid },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "base", label: "Base", icon: Database },
  { id: "curadoria", label: "Curadoria", icon: ClipboardCheck },
];

export default function App() {
  const [tab, setTab] = useState("assessment");
  const [base, setBase] = useState(null);
  const [diag, setDiag] = useState(null);
  const [editingFunc, setEditingFunc] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [diagTarget, setDiagTarget] = useState(null);
  const [ready, setReady] = useState(false);
  const [erro, setErro] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("tema") || "light"; } catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("tema", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const [b, d] = await Promise.all([getBase(), getDiag()]);
        setBase(b);
        setDiag(d || { diagnosticos: [], respostas: [], assessments: [], assessmentRespostas: [] });
        setReady(true);
      } catch (e) {
        setErro(e.message + " — verifique se o servidor está rodando (npm run dev).");
      }
    })();
  }, []);

  const saveBase = async (next) => { setBase(next); try { await putBase(next); } catch (e) { console.error(e); } };
  const saveDiag = async (next) => { setDiag(next); try { await putDiag(next); } catch (e) { console.error(e); } };

  const goToReport = (id) => { setReportId(id); setTab("relatorio"); };
  const goToPlano = (id) => { setReportId(id); setTab("plano"); };
  const goToDiagnostico = (id) => { setDiagTarget(id); setTab("diagnostico"); };
  const goEdit = (fid) => { setEditingFunc(fid); setTab("cadastro"); };

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-slate-700">{erro}</p>
      </div>
    </div>
  );

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando base…</div>
    </div>
  );

  const selectTab = (id) => { setTab(id); if (id !== "cadastro") setEditingFunc(null); setNavOpen(false); };

  const NavList = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200">
        <div className="h-9 w-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-semibold shrink-0">D</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold uppercase tracking-wide text-teal-900 leading-none truncate">Diagnóstico</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mt-1 truncate">base que aprende</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {TABS.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => selectTab(t.id)}
              className={`w-full inline-flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`} /> <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-2 border-t border-slate-200">
        <button onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
          className="w-full inline-flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-400" />}
          <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen">
        <NavList />
      </aside>

      {/* Sidebar — mobile drawer */}
      {navOpen && <div className="md:hidden fixed inset-0 z-40 bg-slate-900/50" onClick={() => setNavOpen(false)} />}
      <aside className={`md:hidden fixed z-50 top-0 left-0 h-full w-64 flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button onClick={() => setNavOpen(false)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        <NavList />
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button onClick={() => setNavOpen(true)} className="text-slate-600 hover:text-slate-900"><Menu className="w-5 h-5" /></button>
          <div className="h-7 w-7 rounded-lg bg-teal-700 flex items-center justify-center text-white text-sm font-semibold">D</div>
          <span className="text-sm font-semibold uppercase tracking-wide text-teal-900">Diagnóstico de Aderência</span>
        </div>

        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 py-8">
            {tab === "assessment" && <Assessment base={base} saveBase={saveBase} diag={diag} saveDiag={saveDiag} />}
            {tab === "cadastro" && <Cadastro base={base} saveBase={saveBase} editing={editingFunc} clearEditing={() => setEditingFunc(null)} />}
            {tab === "curadoria" && <Curadoria base={base} saveBase={saveBase} diag={diag} />}
            {tab === "diagnostico" && <Diagnostico base={base} diag={diag} saveDiag={saveDiag} goToReport={goToReport} openId={diagTarget} clearOpen={() => setDiagTarget(null)} />}
            {tab === "relatorio" && <Relatorio base={base} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} goToPlano={goToPlano} goToDiagnostico={goToDiagnostico} />}
            {tab === "plano" && <PlanoProjeto base={base} saveBase={saveBase} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} />}
            {tab === "kanban" && <Kanban base={base} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} />}
            {tab === "agenda" && <Agenda base={base} diag={diag} selectedId={reportId} setSelectedId={setReportId} />}
            {tab === "base" && <Base base={base} saveBase={saveBase} onEdit={goEdit} />}
          </div>

          <footer className="max-w-5xl mx-auto px-4 pb-8 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-300">o veredito mora na resposta · a descrição escreve o relatório</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
