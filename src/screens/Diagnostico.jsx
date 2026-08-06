import { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronRight, Send, ArrowLeft, X, FileText, Layers, Grid3x3, Box, ListChecks, Play, Plus, Pause } from "lucide-react";
import { uid, nowISO, fmtDate, inputCls, btnTeal, btnGhost, Label, Empty, SectionTitle } from "../ui.jsx";

const ESCOPOS = [
  { id: "segmento", label: "Segmento", icon: Layers, hint: "todas as perguntas do segmento" },
  { id: "area", label: "Área", icon: Grid3x3, hint: "todas as perguntas de uma área" },
  { id: "funcionalidade", label: "Funcionalidade", icon: Box, hint: "uma funcionalidade" },
  { id: "custom", label: "Customizado", icon: ListChecks, hint: "você escolhe as funcionalidades" },
];

export default function Diagnostico({ base, diag, saveDiag, goToReport }) {
  const segmentos = base.segmentos || [];
  const [activeId, setActiveId] = useState(null);
  const [cliente, setCliente] = useState("");
  const [escopo, setEscopo] = useState("segmento");
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [areaSelId, setAreaSelId] = useState(base.areas[0]?.id || "");
  const [funcId, setFuncId] = useState(base.funcionalidades[0]?.id || "");
  const [customIds, setCustomIds] = useState([]);
  const [erro, setErro] = useState("");
  const [outroAberto, setOutroAberto] = useState(false);
  const [textoOutro, setTextoOutro] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const scrollRef = useRef(null);

  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const segNome = (id) => segmentos.find((s) => s.id === id)?.nome || "—";
  const funcNome = (id) => base.funcionalidades.find((f) => f.id === id)?.nome || "—";
  const perguntaById = (id) => base.perguntas.find((p) => p.id === id);
  const opById = (id) => base.opcoes.find((o) => o.id === id);
  const escopoLabelDe = (d) => d.escopo_label || (d.area_id ? "Área · " + areaNome(d.area_id) : "—");

  const diagnosticos = diag.diagnosticos || [];
  const emAndamento = diagnosticos.filter((d) => d.status === "em_andamento");
  const concluidos = diagnosticos.filter((d) => d.status !== "em_andamento");
  const sessao = activeId ? diagnosticos.find((d) => d.id === activeId && d.status === "em_andamento") : null;

  // Perguntas da sessão: snapshot congelado (perguntaIds), na ordem salva.
  const perguntasSel = sessao
    ? (sessao.perguntaIds || []).map((pid) => perguntaById(pid)).filter(Boolean)
        .map((p) => ({ ...p, opcoes: base.opcoes.filter((o) => o.pergunta_id === p.id).sort((a, b) => a.ordem - b.ordem) }))
    : [];
  const respostasSessao = sessao ? (diag.respostas || []).filter((r) => r.diagnostico_id === sessao.id) : [];
  const idx = respostasSessao.length; // respondidas (progresso)
  const answeredIds = new Set(respostasSessao.map((r) => r.pergunta_id));
  const areaDaPergunta = (p) => base.funcionalidades.find((f) => f.id === p.funcionalidade_id)?.area_id;
  const pendentes = perguntasSel.filter((p) => !answeredIds.has(p.id));
  const areasPresentes = [...new Set(perguntasSel.map((p) => areaDaPergunta(p)).filter(Boolean))];
  const pendentesFiltradas = filtroArea ? pendentes.filter((p) => areaDaPergunta(p) === filtroArea) : pendentes;
  const pergunta = pendentesFiltradas[0];

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [idx, activeId, outroAberto, filtroArea]);
  useEffect(() => { setFiltroArea(""); }, [activeId]);

  const resolverFuncIds = () => {
    if (escopo === "segmento") {
      return base.funcionalidades.filter((f) => (f.segmento_ids || []).includes(segId)).map((f) => f.id);
    }
    if (escopo === "area") return base.funcionalidades.filter((f) => f.area_id === areaSelId).map((f) => f.id);
    if (escopo === "funcionalidade") return funcId ? [funcId] : [];
    return customIds;
  };
  const rotuloEscopo = () => {
    if (escopo === "segmento") return "Segmento · " + segNome(segId);
    if (escopo === "area") return "Área · " + areaNome(areaSelId);
    if (escopo === "funcionalidade") return "Funcionalidade · " + funcNome(funcId);
    return `Customizado · ${customIds.length} funcionalidade${customIds.length === 1 ? "" : "s"}`;
  };
  const perguntasAprovadas = (funcIds) => base.perguntas.filter((p) => funcIds.includes(p.funcionalidade_id) && p.status === "aprovada").map((p) => p.id);
  const selecaoValida = () => {
    if (escopo === "segmento") return !!segId;
    if (escopo === "area") return !!areaSelId;
    if (escopo === "funcionalidade") return !!funcId;
    return customIds.length > 0;
  };

  const iniciar = () => {
    setErro("");
    if (!cliente.trim() || !selecaoValida()) return;
    const func_ids = resolverFuncIds();
    const perguntaIds = perguntasAprovadas(func_ids);
    if (!perguntaIds.length) { setErro("Nenhuma pergunta aprovada nesse escopo. Cadastre e aprove perguntas antes."); return; }
    const rec = {
      id: uid(), cliente_nome: cliente.trim(), criado_em: nowISO(), status: "em_andamento",
      escopo, escopo_label: rotuloEscopo(), func_ids, perguntaIds,
      area_id: escopo === "area" ? areaSelId : undefined,
      assessment_id: assessmentId || undefined,
    };
    saveDiag({ ...diag, diagnosticos: [...diagnosticos, rec] });
    setActiveId(rec.id); setOutroAberto(false); setTextoOutro(""); setCliente(""); setAssessmentId("");
  };

  const toggleCustom = (fid) => setCustomIds((c) => c.includes(fid) ? c.filter((x) => x !== fid) : [...c, fid]);

  const escolher = (opcao) => {
    if (opcao.veredito === "rever") { setOutroAberto(true); return; }
    registrar(opcao, null);
  };
  const confirmarOutro = () => {
    if (!textoOutro.trim()) return;
    registrar(pergunta.opcoes.find((o) => o.veredito === "rever"), textoOutro.trim());
  };
  const registrar = (opcao, outro) => {
    const novaResp = { id: uid(), diagnostico_id: sessao.id, pergunta_id: pergunta.id, opcao_id: opcao.id, texto_outro: outro, criado_em: nowISO() };
    const todas = [...respostasSessao, novaResp];
    const ultima = todas.length >= perguntasSel.length;
    let novosDiagnosticos = diagnosticos;
    if (ultima) novosDiagnosticos = diagnosticos.map((d) => d.id === sessao.id ? { ...d, status: "concluido" } : d);
    saveDiag({ ...diag, diagnosticos: novosDiagnosticos, respostas: [...(diag.respostas || []), novaResp] });
    setOutroAberto(false); setTextoOutro("");
    if (ultima) { const id = sessao.id; setActiveId(null); goToReport(id); }
  };

  const incluirNovas = () => {
    const novas = perguntasAprovadas(sessao.func_ids).filter((pid) => !(sessao.perguntaIds || []).includes(pid));
    if (!novas.length) return;
    const novosDiagnosticos = diagnosticos.map((d) => d.id === sessao.id ? { ...d, perguntaIds: [...d.perguntaIds, ...novas] } : d);
    saveDiag({ ...diag, diagnosticos: novosDiagnosticos });
  };

  const descartar = (rec) => {
    if (!confirm("Descartar este diagnóstico e suas respostas?")) return;
    saveDiag({
      ...diag,
      diagnosticos: diagnosticos.filter((d) => d.id !== rec.id),
      respostas: (diag.respostas || []).filter((r) => r.diagnostico_id !== rec.id),
    });
    if (activeId === rec.id) setActiveId(null);
  };

  // ---- Tela inicial ----
  if (!sessao) {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle sub="Escolha o cliente e o escopo. Carrega só o que está aprovado.">Bot de diagnóstico</SectionTitle>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}
          {(diag.assessments || []).length > 0 && (
            <div>
              <Label>Puxar cliente de um assessment (opcional)</Label>
              <select className={inputCls} value={assessmentId} onChange={(e) => {
                const a = (diag.assessments || []).find((x) => x.id === e.target.value);
                setAssessmentId(e.target.value);
                if (a) setCliente(a.cliente_nome);
              }}>
                <option value="">— novo cliente —</option>
                {[...(diag.assessments || [])].reverse().map((a) => (
                  <option key={a.id} value={a.id}>{a.cliente_nome} · {segNome(a.segmento_id)} · {fmtDate(a.criado_em)}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">A empresa que você avaliou no Assessment inicial aparece aqui. Ao escolher, o cliente é preenchido; depois defina as áreas do diagnóstico.</p>
            </div>
          )}
          <div><Label>Cliente</Label><input className={inputCls} placeholder="Nome da empresa" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>

          <div>
            <Label>Escopo do diagnóstico</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ESCOPOS.map((e) => {
                const Icon = e.icon; const active = escopo === e.id;
                return (
                  <button key={e.id} onClick={() => setEscopo(e.id)} title={e.hint}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition ${active ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-500 hover:border-teal-400"}`}>
                    <Icon className="w-4 h-4" /> {e.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{ESCOPOS.find((e) => e.id === escopo)?.hint}</p>
          </div>

          {escopo === "segmento" && (
            <div><Label>Segmento</Label>
              <select className={inputCls} value={segId} onChange={(e) => setSegId(e.target.value)}>
                {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          )}
          {escopo === "area" && (
            <div><Label>Área</Label>
              <select className={inputCls} value={areaSelId} onChange={(e) => setAreaSelId(e.target.value)}>
                {base.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          )}
          {escopo === "funcionalidade" && (
            <div><Label>Funcionalidade</Label>
              <select className={inputCls} value={funcId} onChange={(e) => setFuncId(e.target.value)}>
                {base.funcionalidades.map((f) => <option key={f.id} value={f.id}>{f.nome} · {areaNome(f.area_id)}</option>)}
              </select>
            </div>
          )}
          {escopo === "custom" && (
            <div>
              <Label>Selecione as funcionalidades ({customIds.length})</Label>
              <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {segmentos.map((s) => {
                  const funcsSeg = base.funcionalidades.filter((f) => (f.segmento_ids || []).includes(s.id));
                  if (!funcsSeg.length) return null;
                  return (
                    <div key={s.id} className="p-2">
                      <div className="font-mono text-xs uppercase tracking-widest text-slate-400 px-1 mb-1">{s.nome}</div>
                      {funcsSeg.map((f) => (
                        <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                          <input type="checkbox" checked={customIds.includes(f.id)} onChange={() => toggleCustom(f.id)} className="accent-teal-600" />
                          <span className="text-slate-700">{f.nome}</span>
                          <span className="text-xs text-slate-400 ml-auto">{areaNome(f.area_id)}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className={btnTeal} onClick={iniciar} disabled={!cliente.trim() || !selecaoValida()}><MessageSquare className="w-4 h-4" /> Iniciar diagnóstico</button>
        </div>

        {emAndamento.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-amber-600 mb-2">Em andamento ({emAndamento.length})</h3>
            <div className="space-y-2">
              {[...emAndamento].reverse().map((d) => {
                const total = (d.perguntaIds || []).length;
                const feitas = (diag.respostas || []).filter((r) => r.diagnostico_id === d.id).length;
                return (
                  <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                        <div className="text-xs text-slate-400 font-mono">{escopoLabelDe(d)} · {feitas}/{total} respondidas · {fmtDate(d.criado_em)}</div>
                      </div>
                      <button className={btnTeal + " !py-1.5"} onClick={() => setActiveId(d.id)}><Play className="w-3.5 h-3.5" /> Continuar</button>
                      <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => descartar(d)}>descartar</button>
                    </div>
                    <div className="h-1 w-full rounded-full bg-amber-200 mt-2 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${total ? (feitas / total) * 100 : 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {concluidos.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Diagnósticos concluídos</h3>
            <div className="space-y-2">
              {[...concluidos].reverse().map((d) => (
                <button key={d.id} onClick={() => goToReport(d.id)} className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal-400 transition">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                    <div className="text-xs text-slate-400 font-mono">{escopoLabelDe(d)} · {fmtDate(d.criado_em)}</div>
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

  // ---- Sessão sem perguntas (snapshot vazio) ----
  if (perguntasSel.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Empty icon={MessageSquare} title="Sem perguntas nesta execução" hint="As perguntas deste diagnóstico podem ter sido removidas." />
        <div className="text-center flex gap-2 justify-center">
          <button className={btnGhost} onClick={() => setActiveId(null)}><ArrowLeft className="w-4 h-4" /> Voltar</button>
          <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => descartar(sessao)}>descartar</button>
        </div>
      </div>
    );
  }

  // ---- Tela de responder ----
  const concluiu = idx >= perguntasSel.length;
  const answered = respostasSessao.map((r) => ({ p: perguntaById(r.pergunta_id), o: opById(r.opcao_id), outro: r.texto_outro }));
  const novasDisponiveis = perguntasAprovadas(sessao.func_ids).filter((pid) => !(sessao.perguntaIds || []).includes(pid)).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-slate-800">{sessao.cliente_nome}</span>
          <span className="text-xs text-slate-400 font-mono ml-2">{sessao.escopo_label}</span>
        </div>
        <div className="flex items-center gap-3">
          {novasDisponiveis > 0 && <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={incluirNovas}><Plus className="w-3 h-3" /> incluir {novasDisponiveis} nova{novasDisponiveis > 1 ? "s" : ""}</button>}
          <button className={btnGhost} onClick={() => setActiveId(null)} title="Sai e mantém salvo para continuar depois"><Pause className="w-4 h-4" /> Pausar</button>
          <button className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1" onClick={() => descartar(sessao)}><X className="w-3 h-3" /> descartar</button>
        </div>
      </div>

      {areasPresentes.length > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-400">Responder por área:</span>
          <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areasPresentes.map((aid) => {
              const pend = pendentes.filter((p) => areaDaPergunta(p) === aid).length;
              return <option key={aid} value={aid}>{areaNome(aid)}{pend ? ` (${pend} pendente${pend > 1 ? "s" : ""})` : " (ok)"}</option>;
            })}
          </select>
        </div>
      )}

      <div className="h-1.5 w-full rounded-full bg-slate-200 mb-4 overflow-hidden">
        <div className="h-full bg-teal-600 transition-all" style={{ width: `${(idx / perguntasSel.length) * 100}%` }} />
      </div>

      <div ref={scrollRef} className="rounded-2xl border border-slate-200 bg-white p-5 overflow-y-auto space-y-4" style={{ maxHeight: "52vh" }}>
        {answered.map((a, i) => (
          <div key={i} className="space-y-2">
            <div className="text-sm text-slate-700 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs">{a.p?.texto}</div>
            <div className="flex justify-end"><div className="text-sm text-white bg-teal-700 rounded-2xl rounded-tr-sm px-4 py-2.5 inline-block max-w-xs">{a.outro ? `Outro: ${a.outro}` : a.o?.texto}</div></div>
          </div>
        ))}

        {pergunta ? (
          <div className="space-y-3 pt-1">
            <div className="text-sm text-slate-800 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs font-medium">{pergunta.texto}<span className="block text-xs font-normal text-slate-400 mt-0.5">{areaNome(areaDaPergunta(pergunta))}</span></div>
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
        ) : !concluiu ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-slate-600">
            Área <b>{areaNome(filtroArea)}</b> concluída. Escolha outra área acima (ou “Todas”) para continuar, ou pause e retome depois com o responsável.
          </div>
        ) : null}
      </div>
      <p className="text-center text-xs text-slate-400 mt-2 font-mono">{Math.min(idx, perguntasSel.length)} / {perguntasSel.length}</p>
    </div>
  );
}
