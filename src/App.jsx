import { useState, useEffect } from "react";
import { Sparkles, ClipboardCheck, MessageSquare, FileText, Database, Gauge, Loader2, AlertTriangle, ListChecks, LayoutGrid } from "lucide-react";
import { getBase, putBase, getDiag, putDiag } from "./api.js";
import Assessment from "./screens/Assessment.jsx";
import Cadastro from "./screens/Cadastro.jsx";
import Curadoria from "./screens/Curadoria.jsx";
import Diagnostico from "./screens/Diagnostico.jsx";
import Relatorio from "./screens/Relatorio.jsx";
import PlanoProjeto from "./screens/PlanoProjeto.jsx";
import Kanban from "./screens/Kanban.jsx";
import Base from "./screens/Base.jsx";

const TABS = [
  { id: "diagnostico", label: "Rodar diagnóstico", icon: MessageSquare },
  { id: "assessment", label: "Cadastro de diagnóstico", icon: Gauge },
  { id: "cadastro", label: "Perguntas funcionalidade", icon: Sparkles },
  { id: "relatorio", label: "Pré-relatório", icon: FileText },
  { id: "plano", label: "Plano de projeto", icon: ListChecks },
  { id: "kanban", label: "Quadro (Kanban)", icon: LayoutGrid },
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-teal-700 flex items-center justify-center text-white font-semibold">D</div>
          <div className="flex-1">
            <div className="text-sm font-semibold uppercase tracking-wide text-teal-900 leading-none">Diagnóstico de Aderência</div>
            <div className="font-mono text-xs uppercase tracking-widest text-slate-400 mt-0.5">processo → software · base que aprende</div>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "cadastro") setEditingFunc(null); }}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${active ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === "assessment" && <Assessment base={base} saveBase={saveBase} diag={diag} saveDiag={saveDiag} />}
        {tab === "cadastro" && <Cadastro base={base} saveBase={saveBase} editing={editingFunc} clearEditing={() => setEditingFunc(null)} />}
        {tab === "curadoria" && <Curadoria base={base} saveBase={saveBase} diag={diag} />}
        {tab === "diagnostico" && <Diagnostico base={base} diag={diag} saveDiag={saveDiag} goToReport={goToReport} openId={diagTarget} clearOpen={() => setDiagTarget(null)} />}
        {tab === "relatorio" && <Relatorio base={base} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} goToPlano={goToPlano} goToDiagnostico={goToDiagnostico} />}
        {tab === "plano" && <PlanoProjeto base={base} saveBase={saveBase} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} />}
        {tab === "kanban" && <Kanban base={base} diag={diag} saveDiag={saveDiag} selectedId={reportId} setSelectedId={setReportId} />}
        {tab === "base" && <Base base={base} saveBase={saveBase} onEdit={goEdit} />}
      </main>

      <footer className="max-w-5xl mx-auto px-4 pb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-slate-300">o veredito mora na resposta · a descrição escreve o relatório</p>
      </footer>
    </div>
  );
}
