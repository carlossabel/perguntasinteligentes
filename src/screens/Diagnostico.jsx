import { useState, useMemo, useRef, useEffect } from "react";
import { MessageSquare, ChevronRight, Send, ArrowLeft, X, FileText } from "lucide-react";
import { uid, nowISO, fmtDate, inputCls, btnTeal, btnGhost, Label, Empty, SectionTitle } from "../ui.jsx";

export default function Diagnostico({ base, diag, saveDiag, goToReport }) {
  const [sessao, setSessao] = useState(null);
  const [cliente, setCliente] = useState("");
  const [areaId, setAreaId] = useState(base.areas[0]?.id || "");
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [outroAberto, setOutroAberto] = useState(false);
  const [textoOutro, setTextoOutro] = useState("");
  const scrollRef = useRef(null);

  const perguntasArea = useMemo(() => {
    if (!sessao) return [];
    const fs = base.funcionalidades.filter((f) => f.area_id === sessao.area_id).map((f) => f.id);
    return base.perguntas
      .filter((p) => fs.includes(p.funcionalidade_id) && p.status === "aprovada")
      .map((p) => ({ ...p, opcoes: base.opcoes.filter((o) => o.pergunta_id === p.id).sort((a, b) => a.ordem - b.ordem) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [respostas, idx, outroAberto]);

  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";

  const iniciar = () => {
    if (!cliente.trim() || !areaId) return;
    setSessao({ id: uid(), cliente_nome: cliente.trim(), area_id: areaId, criado_em: nowISO(), status: "em_andamento" });
    setRespostas([]); setIdx(0); setOutroAberto(false); setTextoOutro("");
  };

  const pergunta = perguntasArea[idx];

  const escolher = (opcao) => {
    if (opcao.veredito === "rever") { setOutroAberto(true); return; }
    registrar(opcao, null);
  };
  const confirmarOutro = () => {
    if (!textoOutro.trim()) return;
    registrar(pergunta.opcoes.find((o) => o.veredito === "rever"), textoOutro.trim());
    setOutroAberto(false); setTextoOutro("");
  };
  const registrar = (opcao, outro) => {
    const r = { id: uid(), diagnostico_id: sessao.id, pergunta_id: pergunta.id, opcao_id: opcao.id, texto_outro: outro, criado_em: nowISO() };
    const novas = [...respostas, r];
    setRespostas(novas);
    if (idx + 1 >= perguntasArea.length) finalizar(novas);
    else setIdx(idx + 1);
  };
  const finalizar = (novas) => {
    const dConcluido = { ...sessao, status: "concluido" };
    saveDiag({ diagnosticos: [...diag.diagnosticos, dConcluido], respostas: [...diag.respostas, ...novas] });
    setSessao(null);
    goToReport(dConcluido.id);
  };

  if (!sessao) {
    const anteriores = [...diag.diagnosticos].reverse();
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle sub="Uma pergunta por vez. Carrega só o que está aprovado na área.">Bot de diagnóstico</SectionTitle>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div><Label>Cliente</Label><input className={inputCls} placeholder="Nome da empresa" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
          <div><Label>Área</Label>
            <select className={inputCls} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {base.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <button className={btnTeal} onClick={iniciar} disabled={!cliente.trim()}><MessageSquare className="w-4 h-4" /> Iniciar diagnóstico</button>
        </div>

        {anteriores.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Diagnósticos anteriores</h3>
            <div className="space-y-2">
              {anteriores.map((d) => (
                <button key={d.id} onClick={() => goToReport(d.id)} className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal-400 transition">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                    <div className="text-xs text-slate-400 font-mono">{areaNome(d.area_id)} · {fmtDate(d.criado_em)}</div>
                  </div>
                  <FileText className="w-4 h-4 text-teal-600" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (perguntasArea.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Empty icon={MessageSquare} title="Nenhuma pergunta aprovada nessa área" hint="Cadastre funcionalidades e aprove perguntas antes de diagnosticar." />
        <div className="text-center"><button className={btnGhost} onClick={() => setSessao(null)}><ArrowLeft className="w-4 h-4" /> Voltar</button></div>
      </div>
    );
  }

  const answered = respostas.map((r) => {
    const p = perguntasArea.find((x) => x.id === r.pergunta_id) || base.perguntas.find((x) => x.id === r.pergunta_id);
    const o = base.opcoes.find((x) => x.id === r.opcao_id);
    return { p, o, outro: r.texto_outro };
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-slate-800">{sessao.cliente_nome}</span>
          <span className="text-xs text-slate-400 font-mono ml-2">{areaNome(sessao.area_id)}</span>
        </div>
        <button className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1" onClick={() => setSessao(null)}><X className="w-3 h-3" /> abandonar</button>
      </div>

      <div className="h-1.5 w-full rounded-full bg-slate-200 mb-4 overflow-hidden">
        <div className="h-full bg-teal-600 transition-all" style={{ width: `${(idx / perguntasArea.length) * 100}%` }} />
      </div>

      <div ref={scrollRef} className="rounded-2xl border border-slate-200 bg-white p-5 overflow-y-auto space-y-4" style={{ maxHeight: "52vh" }}>
        {answered.map((a, i) => (
          <div key={i} className="space-y-2">
            <div className="text-sm text-slate-700 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs">{a.p?.texto}</div>
            <div className="flex justify-end"><div className="text-sm text-white bg-teal-700 rounded-2xl rounded-tr-sm px-4 py-2.5 inline-block max-w-xs">{a.outro ? `Outro: ${a.outro}` : a.o?.texto}</div></div>
          </div>
        ))}

        <div className="space-y-3 pt-1">
          <div className="text-sm text-slate-800 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs font-medium">{pergunta.texto}</div>
          {!outroAberto ? (
            <div className="grid gap-2">
              {pergunta.opcoes.map((o) => (
                <button key={o.id} onClick={() => escolher(o)} className="text-left text-sm rounded-xl border border-slate-300 px-4 py-2.5 hover:border-teal-500 hover:bg-teal-50 transition flex items-center justify-between group">
                  <span className="text-slate-700">{o.texto}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-teal-300 bg-teal-50 p-3">
              <Label>Descreva (obrigatório)</Label>
              <textarea className={inputCls} autoFocus value={textoOutro} onChange={(e) => setTextoOutro(e.target.value)} placeholder="Como funciona no caso de vocês…" />
              <div className="flex gap-2 mt-2">
                <button className={btnTeal} onClick={confirmarOutro} disabled={!textoOutro.trim()}><Send className="w-4 h-4" /> Enviar</button>
                <button className={btnGhost} onClick={() => { setOutroAberto(false); setTextoOutro(""); }}>Voltar às opções</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 mt-2 font-mono">{idx + 1} / {perguntasArea.length}</p>
    </div>
  );
}
