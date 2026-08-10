import { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronRight, Send, ArrowLeft, X, FileText, Play, Plus, Pause, Pencil, SkipForward, RotateCcw, Paperclip, Loader2, Image as ImageIcon, Mic } from "lucide-react";
import { uid, nowISO, fmtDate, inputCls, btnTeal, btnGhost, Label, Empty, SectionTitle, tipoAnexo } from "../ui.jsx";
import { uploadAnexo, deleteAnexo } from "../api.js";

const camposOrdenados = (base) => [...(base.camposEmpresa || [])].sort((a, b) => a.ordem - b.ordem);

function CampoInput({ campo, valor, onChange }) {
  if (campo.tipo === "selecao") {
    return (
      <select className={inputCls} value={valor || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(campo.opcoes || []).map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
    );
  }
  return <input className={inputCls} type={campo.tipo === "numero" ? "number" : "text"} value={valor || ""} onChange={(e) => onChange(e.target.value)} placeholder={campo.label} />;
}

export default function Diagnostico({ base, diag, saveDiag, goToReport, openId, clearOpen }) {
  const segmentos = base.segmentos || [];
  const empresas = diag.empresas || [];
  const [activeId, setActiveId] = useState(null);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id || "__nova");
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [escopo, setEscopo] = useState("todas");
  const [customIds, setCustomIds] = useState([]);
  const [dados, setDados] = useState(empresas[0]?.dados ? { ...empresas[0].dados } : {});
  const [filtroArea, setFiltroArea] = useState("");
  const [outroAberto, setOutroAberto] = useState(false);
  const [textoOutro, setTextoOutro] = useState("");
  const [editRespId, setEditRespId] = useState(null);
  const [editReverOpt, setEditReverOpt] = useState(null);
  const [editOutroText, setEditOutroText] = useState("");
  const [puladas, setPuladas] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState("");
  const scrollRef = useRef(null);

  const segNome = (id) => segmentos.find((s) => s.id === id)?.nome || "—";
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";

  const diagnosticos = diag.diagnosticos || [];
  const emAndamento = diagnosticos.filter((d) => d.status === "em_andamento");
  const concluidos = diagnosticos.filter((d) => d.status !== "em_andamento");
  const sessao = activeId ? diagnosticos.find((d) => d.id === activeId) : null;
  const emRevisao = !!(sessao && sessao.status !== "em_andamento");

  // Resolvedores por tipo de item (inicial = macro/assessment; tecnica = funcionalidade).
  const perguntaDe = (it) => it.tipo === "inicial"
    ? (base.assessmentPerguntas || []).find((p) => p.id === it.pergunta_id)
    : base.perguntas.find((p) => p.id === it.pergunta_id);
  const opcoesDe = (it) => it.tipo === "inicial"
    ? (base.assessmentOpcoes || []).filter((o) => o.pergunta_id === it.pergunta_id).sort((a, b) => a.ordem - b.ordem)
    : base.opcoes.filter((o) => o.pergunta_id === it.pergunta_id).sort((a, b) => a.ordem - b.ordem);
  const opById = (id, tipo) => tipo === "inicial" ? (base.assessmentOpcoes || []).find((o) => o.id === id) : base.opcoes.find((o) => o.id === id);
  const areaDe = (it) => {
    if (it.tipo !== "tecnica") return null;
    const p = perguntaDe(it);
    return base.funcionalidades.find((f) => f.id === p?.funcionalidade_id)?.area_id || null;
  };

  const itens = sessao ? (sessao.itens || []).filter((it) => perguntaDe(it)) : [];
  const respostasSessao = sessao ? (diag.respostas || []).filter((r) => r.diagnostico_id === sessao.id) : [];
  const answeredIds = new Set(respostasSessao.map((r) => r.pergunta_id));
  const idx = respostasSessao.length;

  const pendentes = itens.filter((it) => !answeredIds.has(it.pergunta_id));
  const pendIniciais = pendentes.filter((it) => it.tipo === "inicial");
  const pendTecnicas = pendentes.filter((it) => it.tipo === "tecnica");
  const areasPresentes = [...new Set(itens.filter((it) => it.tipo === "tecnica").map(areaDe).filter(Boolean))];
  const naoPulada = (it) => !puladas.includes(it.pergunta_id);
  const pendIniciaisNP = pendIniciais.filter(naoPulada);
  const pendTecnicasNP = pendTecnicas.filter(naoPulada);
  let atualItem;
  if (filtroArea) {
    // Área escolhida: vai direto para as perguntas técnicas dela (mesmo que ainda haja iniciais pendentes).
    atualItem = pendTecnicasNP.filter((it) => areaDe(it) === filtroArea)[0];
  } else if (pendIniciaisNP.length) {
    atualItem = pendIniciaisNP[0];
  } else {
    atualItem = pendTecnicasNP[0];
  }
  const pergunta = atualItem ? { ...perguntaDe(atualItem), opcoes: opcoesDe(atualItem) } : null;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [idx, activeId, outroAberto, filtroArea, puladas.length]);
  useEffect(() => { setFiltroArea(""); setPuladas([]); }, [activeId]);
  useEffect(() => { setAnexos([]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [atualItem?.pergunta_id, activeId]);
  useEffect(() => { if (openId) { setActiveId(openId); clearOpen && clearOpen(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [openId]);

  const selecionarEmpresa = (id) => {
    setEmpresaId(id);
    if (id === "__nova") setDados({});
    else { const e = empresas.find((x) => x.id === id); setDados(e?.dados ? { ...e.dados } : {}); }
  };

  const funcsDoSegmento = (sid) => base.funcionalidades.filter((f) => (f.segmento_ids || []).includes(sid));
  const montarItens = (sid, esc, custom) => {
    const iniciais = esc === "custom" ? [] : (base.assessmentPerguntas || []).filter((p) => p.segmento_id === sid).sort((a, b) => a.ordem - b.ordem).map((p) => ({ pergunta_id: p.id, tipo: "inicial" }));
    let funcIds = [];
    if (esc === "todas") funcIds = funcsDoSegmento(sid).map((f) => f.id);
    else if (esc === "custom") funcIds = custom || [];
    const tecnicas = esc === "iniciais" ? [] : base.perguntas.filter((p) => funcIds.includes(p.funcionalidade_id) && p.status === "aprovada").map((p) => ({ pergunta_id: p.id, tipo: "tecnica" }));
    return { itens: [...iniciais, ...tecnicas], funcIds, nIniciais: iniciais.length, nTecnicas: tecnicas.length };
  };
  const rotuloEscopo = (sid, esc, custom) => {
    if (esc === "iniciais") return "Segmento · " + segNome(sid) + " · perguntas iniciais";
    if (esc === "custom") return `Customizado · ${(custom || []).length} funcionalidade${(custom || []).length === 1 ? "" : "s"}`;
    return "Segmento · " + segNome(sid) + " · completo";
  };
  const toggleCustom = (fid) => setCustomIds((c) => c.includes(fid) ? c.filter((x) => x !== fid) : [...c, fid]);

  const iniciar = () => {
    setErro("");
    if (!segId) { setErro("Escolha um segmento."); return; }
    let listaEmpresas = empresas, empresa;
    if (empresaId === "__nova") {
      if (!novaEmpresa.trim()) { setErro("Dê um nome à empresa."); return; }
      empresa = { id: uid(), nome: novaEmpresa.trim(), dados: { ...dados }, criado_em: nowISO() };
      listaEmpresas = [...empresas, empresa];
    } else {
      const atual = empresas.find((e) => e.id === empresaId);
      if (!atual) { setErro("Escolha uma empresa."); return; }
      empresa = { ...atual, dados: { ...atual.dados, ...dados } };
      listaEmpresas = empresas.map((e) => e.id === empresa.id ? empresa : e);
    }
    const faltando = camposOrdenados(base).filter((c) => c.obrigatorio && !String(dados[c.id] || "").trim());
    if (faltando.length) { setErro("Preencha os campos obrigatórios: " + faltando.map((c) => c.label).join(", ") + "."); return; }
    if (escopo === "custom" && customIds.length === 0) { setErro("Escolha ao menos uma funcionalidade no escopo customizado."); return; }
    const { itens: novosItens, funcIds } = montarItens(segId, escopo, customIds);
    if (!novosItens.length) { setErro("Esse escopo não tem perguntas aprovadas. Cadastre antes."); return; }
    const rec = {
      id: uid(), empresa_id: empresa.id, cliente_nome: empresa.nome, segmento_id: segId,
      escopo, escopo_label: rotuloEscopo(segId, escopo, customIds), dados: { ...dados },
      itens: novosItens, func_ids: funcIds, status: "em_andamento", criado_em: nowISO(),
    };
    saveDiag({ ...diag, empresas: listaEmpresas, diagnosticos: [...diagnosticos, rec] });
    setActiveId(rec.id); setOutroAberto(false); setTextoOutro(""); setNovaEmpresa(""); setDados({}); setEmpresaId(empresa.id); setCustomIds([]);
  };

  const escolher = (opcao) => {
    if (opcao.anexo === "obrigatorio" && anexos.length === 0) { setErro("Esta resposta exige um anexo. Anexe ao menos um arquivo antes de selecioná-la."); return; }
    setErro("");
    if (atualItem.tipo === "tecnica" && opcao.veredito === "rever") { setOutroAberto(true); return; }
    registrar(opcao, null);
  };
  const confirmarOutro = () => {
    if (!textoOutro.trim()) return;
    const rev = pergunta.opcoes.find((o) => o.veredito === "rever");
    if (rev?.anexo === "obrigatorio" && anexos.length === 0) { setErro("Esta resposta exige um anexo."); return; }
    registrar(rev, textoOutro.trim());
  };
  const registrar = (opcao, outro) => {
    const nova = { id: uid(), diagnostico_id: sessao.id, pergunta_id: atualItem.pergunta_id, opcao_id: opcao.id, tipo: atualItem.tipo, texto_outro: outro, anexos: [...anexos], criado_em: nowISO() };
    const todas = [...respostasSessao, nova];
    const ultima = todas.length >= itens.length;
    let novosDiag = diagnosticos;
    if (ultima) {
      const iniciaisResp = todas.filter((r) => r.tipo === "inicial");
      const niveis = iniciaisResp.map((r) => opById(r.opcao_id, "inicial")?.nivel).filter((n) => Number.isFinite(n));
      const maturidade = niveis.length ? Math.round((niveis.reduce((a, b) => a + b, 0) / (niveis.length * 4)) * 100) : null;
      const oportunidades = [...new Set(iniciaisResp.flatMap((r) => opById(r.opcao_id, "inicial")?.oportunidades || []))];
      novosDiag = diagnosticos.map((d) => d.id === sessao.id ? { ...d, status: "concluido", maturidade, oportunidades } : d);
    }
    saveDiag({ ...diag, diagnosticos: novosDiag, respostas: [...(diag.respostas || []), nova] });
    setOutroAberto(false); setTextoOutro("");
    if (ultima) { const id = sessao.id; setActiveId(null); goToReport(id); }
  };

  // ---- Editar uma resposta já dada (em execução ou após concluído) ----
  const editarResposta = (resp, opcao, outro) => {
    const novasRespostas = (diag.respostas || []).map((r) => r.id === resp.id ? { ...r, opcao_id: opcao.id, texto_outro: outro ?? null } : r);
    let novosDiag = diagnosticos;
    const dRec = diagnosticos.find((x) => x.id === resp.diagnostico_id);
    // Se mexeu numa pergunta inicial e todas as iniciais já foram respondidas, recalcula maturidade e oportunidades.
    if (resp.tipo === "inicial" && dRec) {
      const respDoDiag = novasRespostas.filter((r) => r.diagnostico_id === dRec.id);
      const iniciaisResp = respDoDiag.filter((r) => r.tipo === "inicial");
      const totalIniciais = (dRec.itens || []).filter((it) => it.tipo === "inicial").length;
      if (iniciaisResp.length && iniciaisResp.length >= totalIniciais) {
        const niveis = iniciaisResp.map((r) => opById(r.opcao_id, "inicial")?.nivel).filter((n) => Number.isFinite(n));
        const maturidade = niveis.length ? Math.round((niveis.reduce((a, b) => a + b, 0) / (niveis.length * 4)) * 100) : null;
        const oportunidades = [...new Set(iniciaisResp.flatMap((r) => opById(r.opcao_id, "inicial")?.oportunidades || []))];
        novosDiag = diagnosticos.map((x) => x.id === dRec.id ? { ...x, maturidade, oportunidades } : x);
      }
    }
    saveDiag({ ...diag, diagnosticos: novosDiag, respostas: novasRespostas });
  };
  const abrirEdicao = (resp) => { setEditRespId(resp.id); setEditReverOpt(null); setEditOutroText(resp.texto_outro || ""); setOutroAberto(false); };
  const fecharEdicao = () => { setEditRespId(null); setEditReverOpt(null); setEditOutroText(""); };
  const aplicarEdicao = (resp, opcao) => {
    if (resp.tipo === "tecnica" && opcao.veredito === "rever") { setEditReverOpt(opcao); setEditOutroText(resp.texto_outro || ""); return; }
    editarResposta(resp, opcao, null); fecharEdicao();
  };
  const confirmarEdicaoOutro = (resp) => { if (!editOutroText.trim()) return; editarResposta(resp, editReverOpt, editOutroText.trim()); fecharEdicao(); };

  const pular = () => {
    if (!atualItem) return;
    setPuladas((p) => p.includes(atualItem.pergunta_id) ? p : [...p, atualItem.pergunta_id]);
    setOutroAberto(false); setTextoOutro("");
  };
  const revisarPuladas = () => {
    setPuladas((p) => {
      if (!filtroArea) return [];
      return p.filter((pid) => { const it = itens.find((x) => x.pergunta_id === pid); return !(it && it.tipo === "tecnica" && areaDe(it) === filtroArea); });
    });
  };

  const onSelecionarArquivos = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErro(""); setSubindo(true);
    try {
      for (const f of files) {
        const meta = await uploadAnexo(f);
        setAnexos((a) => [...a, meta]);
      }
    } catch (err) { setErro("Falha ao anexar: " + err.message); }
    finally { setSubindo(false); }
  };
  const removerAnexo = (a) => { setAnexos((cur) => cur.filter((x) => x.id !== a.id)); deleteAnexo(a.url); };

  const incluirNovas = () => {
    const funcIds = sessao.func_ids || [];
    const existentes = new Set((sessao.itens || []).map((it) => it.pergunta_id));
    const novas = base.perguntas.filter((p) => funcIds.includes(p.funcionalidade_id) && p.status === "aprovada" && !existentes.has(p.id)).map((p) => ({ pergunta_id: p.id, tipo: "tecnica" }));
    if (!novas.length) return;
    saveDiag({ ...diag, diagnosticos: diagnosticos.map((d) => d.id === sessao.id ? { ...d, itens: [...d.itens, ...novas] } : d) });
  };

  const descartar = (rec) => {
    if (!confirm("Descartar este diagnóstico e suas respostas?")) return;
    saveDiag({ ...diag, diagnosticos: diagnosticos.filter((d) => d.id !== rec.id), respostas: (diag.respostas || []).filter((r) => r.diagnostico_id !== rec.id) });
    if (activeId === rec.id) setActiveId(null);
  };

  // ---- Tela inicial ----
  if (!sessao) {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionTitle sub="Escolha a empresa e o segmento. Roda as perguntas iniciais (macro) e as técnicas do segmento, em sequência.">Bot de diagnóstico</SectionTitle>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <div><Label>Empresa</Label>
            <select className={inputCls} value={empresaId} onChange={(e) => selecionarEmpresa(e.target.value)}>
              <option value="__nova">+ Nova empresa</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            {empresaId === "__nova"
              ? <input className={inputCls + " mt-2"} placeholder="Nome da nova empresa" value={novaEmpresa} onChange={(e) => setNovaEmpresa(e.target.value)} />
              : <p className="text-xs text-slate-400 mt-1">Os dados abaixo vêm desta empresa e são enriquecidos a cada diagnóstico.</p>}
          </div>
          <div><Label>Segmento</Label>
            <select className={inputCls} value={segId} onChange={(e) => { setSegId(e.target.value); setCustomIds([]); }}>
              {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div>
            <Label>O que rodar</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[["iniciais", "Perguntas iniciais", "só as perguntas macro do segmento"], ["todas", "Todas do segmento", "iniciais + técnicas de todas as funcionalidades"], ["custom", "Customizado", "você escolhe as funcionalidades"]].map(([id, l, hint]) => (
                <button key={id} onClick={() => setEscopo(id)} title={hint}
                  className={`text-left rounded-xl border px-3 py-2.5 text-sm font-medium transition ${escopo === id ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-500 hover:border-teal-400"}`}>
                  {l}<span className="block text-[11px] font-normal text-slate-400 mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
            {segId && escopo !== "custom" && (() => { const m = montarItens(segId, escopo, customIds); return <p className="text-xs text-slate-400 mt-1.5">{m.nIniciais} inicial(is) + {m.nTecnicas} técnica(s) = {m.itens.length} pergunta(s).</p>; })()}
          </div>

          {escopo === "custom" && (
            <div>
              <Label>Funcionalidades ({customIds.length})</Label>
              <div className="rounded-xl border border-slate-200 max-h-56 overflow-y-auto divide-y divide-slate-100">
                {funcsDoSegmento(segId).length === 0 && <p className="text-sm text-slate-400 p-3">Nenhuma funcionalidade neste segmento.</p>}
                {funcsDoSegmento(segId).map((f) => (
                  <label key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input type="checkbox" className="accent-teal-600" checked={customIds.includes(f.id)} onChange={() => toggleCustom(f.id)} />
                    <span className="text-slate-700">{f.nome}</span>
                    <span className="text-xs text-slate-400 ml-auto">{areaNome(f.area_id)}</span>
                  </label>
                ))}
              </div>
              {customIds.length > 0 && (() => { const m = montarItens(segId, escopo, customIds); return <p className="text-xs text-slate-400 mt-1.5">{m.nTecnicas} pergunta(s) técnica(s) nas selecionadas.</p>; })()}
            </div>
          )}
          {camposOrdenados(base).length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
              {camposOrdenados(base).map((c) => (
                <div key={c.id}>
                  <Label>{c.label}{c.obrigatorio && <span className="text-red-500"> *</span>}</Label>
                  <CampoInput campo={c} valor={dados[c.id]} onChange={(v) => setDados((d) => ({ ...d, [c.id]: v }))} />
                </div>
              ))}
            </div>
          )}
          <button className={btnTeal} onClick={iniciar} disabled={!segId || (empresaId === "__nova" && !novaEmpresa.trim())}><MessageSquare className="w-4 h-4" /> Iniciar diagnóstico</button>
        </div>

        {emAndamento.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-amber-600 mb-2">Em andamento ({emAndamento.length})</h3>
            <div className="space-y-2">
              {[...emAndamento].reverse().map((d) => {
                const total = (d.itens || []).length;
                const feitas = (diag.respostas || []).filter((r) => r.diagnostico_id === d.id).length;
                return (
                  <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                        <div className="text-xs text-slate-400 font-mono">{d.escopo_label} · {feitas}/{total} respondidas · {fmtDate(d.criado_em)}</div>
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
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-teal-400 transition">
                  <button onClick={() => goToReport(d.id)} className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{d.cliente_nome}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{d.escopo_label} · {fmtDate(d.criado_em)}</div>
                  </button>
                  <button onClick={() => setActiveId(d.id)} className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1 shrink-0"><Pencil className="w-3 h-3" /> corrigir</button>
                  <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Sessão sem itens (snapshot vazio) ----
  if (itens.length === 0) {
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
  const concluiu = idx >= itens.length;
  const answered = respostasSessao.map((r) => ({ r, p: perguntaDe({ pergunta_id: r.pergunta_id, tipo: r.tipo }), o: opById(r.opcao_id, r.tipo), outro: r.texto_outro }));
  const novasDisponiveis = (() => {
    const funcIds = sessao.func_ids || [];
    const existentes = new Set((sessao.itens || []).map((it) => it.pergunta_id));
    return base.perguntas.filter((p) => funcIds.includes(p.funcionalidade_id) && p.status === "aprovada" && !existentes.has(p.id)).length;
  })();
  const faseAtual = atualItem?.tipo === "inicial" ? "Pergunta inicial (macro)" : atualItem ? areaNome(areaDe(atualItem)) : "";
  const puladasPend = pendentes.filter((it) => puladas.includes(it.pergunta_id)).length;
  const escopoPuladas = filtroArea
    ? pendentes.filter((it) => it.tipo === "tecnica" && areaDe(it) === filtroArea && puladas.includes(it.pergunta_id))
    : pendentes.filter((it) => puladas.includes(it.pergunta_id));
  const algumAnexo = !!(pergunta && pergunta.opcoes.some((o) => o.anexo && o.anexo !== "nao"));
  const algumObrig = !!(pergunta && pergunta.opcoes.some((o) => o.anexo === "obrigatorio"));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-slate-800">{sessao.cliente_nome}</span>
          <span className="text-xs text-slate-400 font-mono ml-2">{sessao.escopo_label}</span>
        </div>
        <div className="flex items-center gap-3">
          {!emRevisao && novasDisponiveis > 0 && <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={incluirNovas}><Plus className="w-3 h-3" /> incluir {novasDisponiveis} nova{novasDisponiveis > 1 ? "s" : ""}</button>}
          {emRevisao && (
            <button className={btnTeal + " !py-1.5"} onClick={() => { const id = sessao.id; setActiveId(null); goToReport(id); }}><FileText className="w-4 h-4" /> Voltar ao pré-relatório</button>
          )}
        </div>
      </div>

      {emRevisao && (
        <div className="mb-3 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800 flex items-center gap-2">
          <Pencil className="w-3.5 h-3.5" /> Modo revisão — clique no lápis em qualquer resposta para corrigi-la. Mudanças em perguntas iniciais recalculam maturidade e oportunidades.
        </div>
      )}

      {pendTecnicas.length > 0 && areasPresentes.length >= 1 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Ir para área</span>
            {pendIniciais.length > 0 && !filtroArea && <span className="text-[11px] text-amber-600">· respondendo as iniciais (macro) primeiro</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFiltroArea("")}
              className={`text-xs rounded-full px-3 py-1.5 border transition ${filtroArea === "" ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-300 hover:border-teal-400"}`}>
              Todas{pendIniciais.length > 0 ? " (com iniciais)" : ""}
            </button>
            {areasPresentes.map((aid) => {
              const pend = pendentes.filter((it) => it.tipo === "tecnica" && areaDe(it) === aid).length;
              const done = pend === 0;
              return (
                <button key={aid} onClick={() => setFiltroArea(aid)} disabled={done}
                  className={`text-xs rounded-full px-3 py-1.5 border transition ${filtroArea === aid ? "bg-teal-700 text-white border-teal-700" : done ? "bg-slate-50 text-slate-300 border-slate-200 cursor-default" : "bg-white text-slate-600 border-slate-300 hover:border-teal-400"}`}>
                  {areaNome(aid)} {done ? "✓" : `· ${pend}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-1.5 w-full rounded-full bg-slate-200 mb-4 overflow-hidden">
        <div className="h-full bg-teal-600 transition-all" style={{ width: `${(idx / itens.length) * 100}%` }} />
      </div>

      <div ref={scrollRef} className="rounded-2xl border border-slate-200 bg-white p-5 overflow-y-auto space-y-4" style={{ maxHeight: "52vh" }}>
        {answered.map((a) => (
          <div key={a.r.id} className="space-y-2">
            <div className="text-sm text-slate-700 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs">{a.p?.texto}</div>
            {editRespId === a.r.id ? (
              <div className="rounded-xl border border-teal-300 bg-teal-50/60 p-3 space-y-2">
                {!editReverOpt ? (
                  <>
                    <div className="grid gap-2">
                      {opcoesDe({ pergunta_id: a.r.pergunta_id, tipo: a.r.tipo }).map((o) => (
                        <button key={o.id} onClick={() => aplicarEdicao(a.r, o)}
                          className={`text-left text-sm rounded-xl border px-4 py-2.5 transition flex items-center justify-between ${o.id === a.r.opcao_id ? "border-teal-500 bg-teal-100 text-teal-900" : "border-slate-300 hover:border-teal-500 hover:bg-teal-50 text-slate-700"}`}>
                          <span>{o.texto}</span>
                          {o.id === a.r.opcao_id && <span className="text-[10px] font-mono uppercase tracking-wider text-teal-600">atual</span>}
                        </button>
                      ))}
                    </div>
                    <button className="text-xs text-slate-400 hover:text-slate-600" onClick={fecharEdicao}>cancelar</button>
                  </>
                ) : (
                  <div>
                    <Label>Descreva (obrigatório)</Label>
                    <textarea className={inputCls} autoFocus value={editOutroText} onChange={(e) => setEditOutroText(e.target.value)} placeholder="Como funciona no caso de vocês…" />
                    <div className="flex gap-2 mt-2">
                      <button className={btnTeal} onClick={() => confirmarEdicaoOutro(a.r)} disabled={!editOutroText.trim()}><Send className="w-4 h-4" /> Salvar</button>
                      <button className={btnGhost} onClick={() => setEditReverOpt(null)}>Voltar às opções</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-end items-center gap-1.5">
                <button onClick={() => abrirEdicao(a.r)} title="Corrigir esta resposta" className="text-slate-300 hover:text-teal-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
                <div className="text-sm text-white bg-teal-700 rounded-2xl rounded-tr-sm px-4 py-2.5 inline-block max-w-xs">{a.outro ? `Outro: ${a.outro}` : a.o?.texto}</div>
              </div>
            )}
          </div>
        ))}

        {pergunta ? (
          <div className="space-y-3 pt-1">
            <div className="text-sm text-slate-800 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs font-medium">{pergunta.texto}<span className="block text-xs font-normal text-slate-400 mt-0.5">{faseAtual}</span></div>

            {algumAnexo && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Anexos {algumObrig ? "· algumas respostas exigem" : "· opcional"}</span>
                  <label className={btnGhost + " cursor-pointer !py-1.5"}>
                    <Paperclip className="w-4 h-4" /> Anexar
                    <input type="file" className="hidden" multiple accept="image/*,audio/*,.pdf" onChange={onSelecionarArquivos} />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">Documento, foto ou áudio como evidência — vai para o pré-relatório.</p>
                {subindo && <div className="text-xs text-slate-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> enviando…</div>}
                {anexos.length > 0 && (
                  <ul className="space-y-1">
                    {anexos.map((a) => {
                      const t = tipoAnexo(a.tipo);
                      return (
                        <li key={a.id} className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1">
                          {t === "image" ? <ImageIcon className="w-3.5 h-3.5 text-slate-400" /> : t === "audio" ? <Mic className="w-3.5 h-3.5 text-slate-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="flex-1 truncate">{a.nome}</span>
                          <button onClick={() => removerAnexo(a)} className="text-slate-300 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {!outroAberto ? (
              <div className="grid gap-2">
                {pergunta.opcoes.map((o) => (
                  <button key={o.id} onClick={() => escolher(o)}
                    className="text-left text-sm rounded-xl border border-slate-300 px-4 py-2.5 hover:border-teal-500 hover:bg-teal-50 transition flex items-center justify-between group">
                    <span className="text-slate-700">{o.texto}</span>
                    <span className="flex items-center gap-1.5">
                      {o.anexo && o.anexo !== "nao" && <Paperclip className={`w-3.5 h-3.5 ${o.anexo === "obrigatorio" ? "text-amber-500" : "text-slate-300"}`} title={o.anexo === "obrigatorio" ? "Exige anexo" : "Permite anexo"} />}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600" />
                    </span>
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
          escopoPuladas.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-600 space-y-3">
              <div>
                {escopoPuladas.length} pergunta{escopoPuladas.length > 1 ? "s" : ""} pulada{escopoPuladas.length > 1 ? "s" : ""}{filtroArea ? <> na área <b>{areaNome(filtroArea)}</b></> : ""} — ainda sem resposta. Você pode revisá-las agora, trocar de área, ou pausar e retomar depois com o responsável.
              </div>
              <button className={btnTeal} onClick={revisarPuladas}><RotateCcw className="w-4 h-4" /> Revisar pulada{escopoPuladas.length > 1 ? "s" : ""}</button>
            </div>
          ) : (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-slate-600">
              Área <b>{areaNome(filtroArea)}</b> concluída. Escolha outra área acima (ou “Todas”), ou pause e retome depois com o responsável.
            </div>
          )
        ) : null}
      </div>
      {!emRevisao && (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {pergunta && !outroAberto && (
            <button className={btnGhost} onClick={pular} title="Deixa a pergunta pendente e vai para a próxima; você responde depois"><SkipForward className="w-4 h-4" /> Pular</button>
          )}
          <button className={btnGhost} onClick={() => setActiveId(null)} title="Sai e mantém salvo para continuar depois"><Pause className="w-4 h-4" /> Pausar</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition" onClick={() => descartar(sessao)}><X className="w-4 h-4" /> Descartar</button>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-2 font-mono">{Math.min(idx, itens.length)} / {itens.length}{puladasPend > 0 ? ` · ${puladasPend} pulada${puladasPend > 1 ? "s" : ""}` : ""}</p>
    </div>
  );
}
