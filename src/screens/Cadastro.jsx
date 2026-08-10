import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus, Trash2, Check, X, Loader2, AlertTriangle, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { VEREDITOS, AREAS_CONSULTORIA, uid, slug, nowISO, inputCls, btnTeal, btnGhost, Label, SectionTitle } from "../ui.jsx";
import { generate } from "../api.js";

export default function Cadastro({ base, saveBase, editing, clearEditing }) {
  const segmentos = base.segmentos || [];
  const [nome, setNome] = useState("");
  const [segmentoIds, setSegmentoIds] = useState([]);
  const [areaId, setAreaId] = useState(base.areas[0]?.id || "");
  const [novaArea, setNovaArea] = useState("");
  const [codigo, setCodigo] = useState("");
  const [comoAtende, setComoAtende] = useState("");
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [tarefas, setTarefas] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const f = base.funcionalidades.find((x) => x.id === editing);
    if (!f) return;
    setNome(f.nome); setCodigo(f.codigo);
    setSegmentoIds(Array.isArray(f.segmento_ids) ? f.segmento_ids : []);
    setAreaId(f.area_id);
    setComoAtende(f.como_atende || "");
    if (f.como_atende) setShowDetalhes(true);
    setTarefas(Array.isArray(f.tarefas) ? f.tarefas.map((t) => ({ id: t.id, nome: t.nome || "", horas: t.horas ?? "", area: t.area || AREAS_CONSULTORIA[0] })) : []);
    const pg = base.perguntas.filter((p) => p.funcionalidade_id === f.id).map((p) => ({
      texto: p.texto, disposicao: p.status === "aprovada" ? "usar" : "curar", anexo: p.anexo || "nao",
      opcoes: base.opcoes.filter((o) => o.pergunta_id === p.id).sort((a, b) => a.ordem - b.ordem).map((o) => ({ texto: o.texto, veredito: o.veredito })),
    }));
    setPerguntas(pg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const toggleSegmento = (id) => setSegmentoIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const resetForm = () => {
    setNome(""); setCodigo(""); setNovaArea(""); setSegmentoIds([]); setShowDetalhes(false);
    setComoAtende("");
    setTarefas([]);
    setPerguntas([]); setErro(""); clearEditing();
  };

  const handleIA = async () => {
    if (!nome.trim()) { setErro("Digite o nome da funcionalidade primeiro."); return; }
    setErro(""); setLoading(true);
    try {
      const out = await generate(nome.trim(), areaId);
      if (out.como_atende) { setComoAtende(out.como_atende); setShowDetalhes(true); }
      const novas = (out.perguntas || []).map((p) => ({
        texto: p.pergunta || p.texto || "",
        disposicao: "usar",
        anexo: "nao",
        opcoes: (p.opcoes || []).map((o) => ({ texto: o.texto || "", veredito: VEREDITOS[o.veredito] ? o.veredito : "rever" })),
      }));
      setPerguntas((cur) => [...cur, ...novas]);
    } catch (e) {
      setErro("Não consegui gerar automaticamente. Preencha manualmente. (" + e.message + ")");
    } finally { setLoading(false); }
  };

  const addPerguntaManual = () =>
    setPerguntas((p) => [...p, { texto: "", disposicao: "usar", anexo: "nao", opcoes: [{ texto: "", veredito: "atende" }, { texto: "Outro", veredito: "rever" }] }]);
  const updPergunta = (i, patch) => setPerguntas((p) => p.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updOpcao = (pi, oi, patch) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: q.opcoes.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : q)));
  const addOpcao = (pi) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: [...q.opcoes, { texto: "", veredito: "atende" }] } : q)));
  const rmOpcao = (pi, oi) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: q.opcoes.filter((_, j) => j !== oi) } : q)));
  const rmPergunta = (i) => setPerguntas((p) => p.filter((_, k) => k !== i));

  const addTarefa = () => setTarefas((t) => [...t, { id: uid(), nome: "", horas: "", area: AREAS_CONSULTORIA[0] }]);
  const updTarefa = (i, patch) => setTarefas((t) => t.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const rmTarefa = (i) => setTarefas((t) => t.filter((_, k) => k !== i));
  const totalHoras = tarefas.reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const dragTarefa = useRef(null);
  const reordenarTarefa = (to) => {
    const from = dragTarefa.current; dragTarefa.current = null;
    if (from == null || from === to) return;
    setTarefas((arr) => { const a = [...arr]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; });
  };

  const gerarCodigoUnico = (baseCod) => {
    const existentes = new Set(base.funcionalidades.filter((f) => f.id !== editing).map((f) => f.codigo));
    let cod = baseCod || "func";
    if (!existentes.has(cod)) return cod;
    let n = 2;
    while (existentes.has(`${cod}-${n}`)) n++;
    return `${cod}-${n}`;
  };

  const salvar = () => {
    setErro("");
    if (!nome.trim()) { setErro("A funcionalidade precisa de um nome."); return; }
    if (segmentoIds.length === 0) { setErro("Vincule a pelo menos um segmento."); return; }

    // Área (global): escolhida ou nova
    let aId = areaId, areas = base.areas;
    if (novaArea.trim()) { aId = uid(); areas = [...areas, { id: aId, nome: novaArea.trim() }]; }
    if (!aId) { setErro("Escolha ou crie uma área."); return; }

    const cod = (editing && codigo.trim()) ? codigo.trim() : gerarCodigoUnico(slug(nome));
    const usaveis = perguntas.filter((p) => p.disposicao !== "descartar" && p.texto.trim());
    const tarefasLimpa = tarefas
      .filter((t) => t.nome.trim())
      .map((t) => ({ id: t.id || uid(), nome: t.nome.trim(), horas: Number(t.horas) || 0, area: t.area || AREAS_CONSULTORIA[0] }));
    let funcionalidades, perguntasArr, opcoesArr;

    if (editing) {
      const fid = editing;
      funcionalidades = base.funcionalidades.map((f) => f.id === fid ? { ...f, area_id: aId, segmento_ids: [...segmentoIds], codigo: cod, nome: nome.trim(), como_atende: comoAtende, tarefas: tarefasLimpa, atualizado_em: nowISO() } : f);
      const antigas = base.perguntas.filter((p) => p.funcionalidade_id === fid).map((p) => p.id);
      perguntasArr = base.perguntas.filter((p) => p.funcionalidade_id !== fid);
      opcoesArr = base.opcoes.filter((o) => !antigas.includes(o.pergunta_id));
      usaveis.forEach((p) => {
        const pid = uid();
        perguntasArr.push({ id: pid, funcionalidade_id: fid, texto: p.texto.trim(), origem: "humano", status: p.disposicao === "usar" ? "aprovada" : "sugerida", motivo: "", avaliado_por: "consultor", anexo: p.anexo || "nao", criado_em: nowISO() });
        p.opcoes.filter((o) => o.texto.trim()).forEach((o, idx) => opcoesArr.push({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), veredito: o.veredito, ordem: idx }));
      });
    } else {
      const fid = uid();
      funcionalidades = [...base.funcionalidades, { id: fid, area_id: aId, segmento_ids: [...segmentoIds], codigo: cod, nome: nome.trim(), como_atende: comoAtende, tarefas: tarefasLimpa, criado_em: nowISO(), atualizado_em: nowISO() }];
      perguntasArr = [...base.perguntas];
      opcoesArr = [...base.opcoes];
      usaveis.forEach((p) => {
        const pid = uid();
        perguntasArr.push({ id: pid, funcionalidade_id: fid, texto: p.texto.trim(), origem: "ia", status: p.disposicao === "usar" ? "aprovada" : "sugerida", motivo: "", avaliado_por: "consultor", anexo: p.anexo || "nao", criado_em: nowISO() });
        p.opcoes.filter((o) => o.texto.trim()).forEach((o, idx) => opcoesArr.push({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), veredito: o.veredito, ordem: idx }));
      });
    }
    saveBase({ ...base, areas, funcionalidades, perguntas: perguntasArr, opcoes: opcoesArr });
    setOk(true); setTimeout(() => setOk(false), 2500);
    resetForm();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="Dê um nome à funcionalidade, vincule a um ou mais segmentos e a uma área, deixe a IA sugerir e cure antes de salvar.">
        {editing ? "Editar perguntas da funcionalidade" : "Cadastro de perguntas da funcionalidade"}
      </SectionTitle>

      {ok && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2"><Check className="w-4 h-4" /> Salvo na base.</div>}
      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {erro}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <Label>Nome da funcionalidade</Label>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="ex.: Apontamento de produção" value={nome} onChange={(e) => setNome(e.target.value)} />
            <button className={btnTeal + " whitespace-nowrap"} onClick={handleIA} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Gerando…" : "Sugerir com IA"}
            </button>
          </div>
        </div>

        <div>
          <Label>Segmentos ({segmentoIds.length}) — um ou mais</Label>
          {segmentos.length === 0 ? <p className="text-sm text-slate-400">Nenhum segmento ainda. Crie na aba Assessment.</p>
            : <div className="flex flex-wrap gap-1.5">
              {segmentos.map((s) => {
                const on = segmentoIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSegmento(s.id)}
                    className={`text-sm rounded-full px-3 py-1.5 border transition ${on ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-300 hover:border-teal-400"}`}>
                    {on && <Check className="w-3 h-3 inline mr-1" />}{s.nome}
                  </button>
                );
              })}
            </div>}
          <p className="text-xs text-slate-400 mt-1">Crie novos segmentos na aba Assessment.</p>
        </div>

        <div>
          <Label>Área</Label>
          <select className={inputCls} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {base.areas.length === 0 && <option value="">— nenhuma área ainda —</option>}
            {base.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <input className={inputCls + " mt-2"} placeholder="…ou crie uma nova área" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <Label>Como atende</Label>
        <p className="text-xs text-slate-400 mb-2">Texto que aparece no relatório <b>apenas</b> nas respostas cujo veredito for “atende” — descreve como o sistema cobre esse processo. A IA pode preencher.</p>
        <textarea className={inputCls + " resize-y"} style={{ minHeight: 80 }} value={comoAtende} onChange={(e) => setComoAtende(e.target.value)} placeholder="ex.: O sistema registra a produção em tempo real por ordem e operação, com baixa automática de insumos." />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-teal-700">Tarefas de implantação</span>
            <span className="text-xs text-slate-400 ml-2">— passo a passo para implantar a funcionalidade</span>
          </div>
          <button className={btnGhost} onClick={addTarefa}><Plus className="w-4 h-4" /> Tarefa</button>
        </div>

        {tarefas.length === 0 && <p className="text-sm text-slate-400 py-3">Nenhuma tarefa ainda. Liste as etapas de implantação — cada uma com o tempo em horas e a área da consultoria responsável.</p>}

        {tarefas.length > 0 && (
          <>
            <div className="hidden sm:grid grid-cols-[20px,1fr,96px,200px,32px] gap-2 mt-3 mb-1 px-1">
              <span />
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Tarefa</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Horas</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">Área da consultoria</span>
              <span />
            </div>
            <div className="space-y-2">
              {tarefas.map((t, i) => (
                <div key={t.id || i} onDragOver={(e) => e.preventDefault()} onDrop={() => reordenarTarefa(i)}
                  className="grid grid-cols-1 sm:grid-cols-[20px,1fr,96px,200px,32px] gap-2 sm:items-center rounded-lg">
                  <span draggable onDragStart={() => { dragTarefa.current = i; }}
                    className="hidden sm:flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" title="Arraste para reordenar">
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <input className={inputCls} placeholder="ex.: Parametrizar centros de trabalho" value={t.nome} onChange={(e) => updTarefa(i, { nome: e.target.value })} />
                  <input type="number" min="0" step="0.5" className={inputCls} placeholder="horas" value={t.horas} onChange={(e) => updTarefa(i, { horas: e.target.value })} />
                  <select className={inputCls} value={t.area} onChange={(e) => updTarefa(i, { area: e.target.value })}>
                    {AREAS_CONSULTORIA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button className="p-2 text-slate-400 hover:text-red-600 justify-self-end" onClick={() => rmTarefa(i)}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            {totalHoras > 0 && (
              <div className="mt-3 text-right font-mono text-xs uppercase tracking-widest text-slate-500">Total estimado: {totalHoras} h</div>
            )}
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-teal-700">Decide o resultado</span>
            <span className="text-xs text-slate-400 ml-2">— o veredito mora em cada opção</span>
          </div>
          <button className={btnGhost} onClick={addPerguntaManual}><Plus className="w-4 h-4" /> Pergunta</button>
        </div>

        {perguntas.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhuma pergunta ainda. Gere com a IA ou adicione manualmente.</p>}

        <div className="space-y-4">
          {perguntas.map((p, pi) => (
            <div key={pi} className={`rounded-xl border p-4 ${p.disposicao === "descartar" ? "opacity-40 border-slate-200" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-start gap-2 mb-3">
                <input className={inputCls} placeholder="Como a empresa faz isso hoje?" value={p.texto} onChange={(e) => updPergunta(pi, { texto: e.target.value })} />
                <button className="p-2 text-slate-400 hover:text-red-600" onClick={() => rmPergunta(pi)}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-1.5 mb-3">
                {[["usar", "Usar → aprovada"], ["curar", "Curar depois"], ["descartar", "Descartar"]].map(([v, l]) => (
                  <button key={v} onClick={() => updPergunta(pi, { disposicao: v })}
                    className={`text-xs font-mono uppercase tracking-wider rounded-full px-2.5 py-1 border transition ${p.disposicao === v ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-300 hover:border-teal-400"}`}>{l}</button>
                ))}
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mb-3">
                <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mr-1">Anexo (evidência)</span>
                {[["nao", "Não"], ["opcional", "Opcional"], ["obrigatorio", "Obrigatório"]].map(([v, l]) => (
                  <button key={v} onClick={() => updPergunta(pi, { anexo: v })}
                    className={`text-xs font-mono uppercase tracking-wider rounded-full px-2.5 py-1 border transition ${(p.anexo || "nao") === v ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-300 hover:border-teal-400"}`}>{l}</button>
                ))}
              </div>
              <div className="space-y-2">
                {p.opcoes.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input className={inputCls} placeholder="Texto da opção" value={o.texto} onChange={(e) => updOpcao(pi, oi, { texto: e.target.value })} />
                    <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-mono outline-none focus:border-teal-500" value={o.veredito} onChange={(e) => updOpcao(pi, oi, { veredito: e.target.value })}>
                      {Object.keys(VEREDITOS).map((v) => <option key={v} value={v}>{VEREDITOS[v].short}</option>)}
                    </select>
                    <button className="p-2 text-slate-400 hover:text-red-600" onClick={() => rmOpcao(pi, oi)}><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={() => addOpcao(pi)}><Plus className="w-3 h-3" /> opção</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {editing && <button className={btnGhost} onClick={resetForm}>Cancelar edição</button>}
        <button className={btnTeal} onClick={salvar}><Check className="w-4 h-4" /> {editing ? "Salvar alterações" : "Salvar na base"}</button>
      </div>
    </div>
  );
}
