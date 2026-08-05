import { useState, useEffect } from "react";
import { Sparkles, Plus, Trash2, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { VEREDITOS, uid, slug, nowISO, inputCls, btnTeal, btnGhost, Label, SectionTitle } from "../ui.jsx";
import { generate } from "../api.js";

export default function Cadastro({ base, saveBase, editing, clearEditing }) {
  const segmentos = base.segmentos || [];
  const [segmentoId, setSegmentoId] = useState(segmentos[0]?.id || "");
  const [novoSegmento, setNovoSegmento] = useState("");
  const [areaId, setAreaId] = useState("");
  const [novaArea, setNovaArea] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [desc, setDesc] = useState({ objetivo: "", fluxo: "", beneficio: "", risco: "", limitacoes: "", cadastrar: "" });
  const [perguntas, setPerguntas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const areasDoSegmento = base.areas.filter((a) => a.segmento_id === segmentoId);

  // Mantém a área coerente com o segmento selecionado.
  useEffect(() => {
    if (novaArea.trim()) return;
    if (!areasDoSegmento.find((a) => a.id === areaId)) setAreaId(areasDoSegmento[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentoId]);

  useEffect(() => {
    if (!editing) return;
    const f = base.funcionalidades.find((x) => x.id === editing);
    if (!f) return;
    const area = base.areas.find((a) => a.id === f.area_id);
    if (area?.segmento_id) setSegmentoId(area.segmento_id);
    setAreaId(f.area_id); setNome(f.nome); setCodigo(f.codigo);
    setDesc({ objetivo: f.objetivo || "", fluxo: f.fluxo || "", beneficio: f.beneficio || "", risco: f.risco || "", limitacoes: f.limitacoes || "", cadastrar: f.cadastrar || "" });
    const pg = base.perguntas.filter((p) => p.funcionalidade_id === f.id).map((p) => ({
      texto: p.texto, disposicao: p.status === "aprovada" ? "usar" : "curar",
      opcoes: base.opcoes.filter((o) => o.pergunta_id === p.id).sort((a, b) => a.ordem - b.ordem).map((o) => ({ texto: o.texto, veredito: o.veredito })),
    }));
    setPerguntas(pg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const resetForm = () => {
    setNome(""); setCodigo(""); setNovaArea(""); setNovoSegmento("");
    setDesc({ objetivo: "", fluxo: "", beneficio: "", risco: "", limitacoes: "", cadastrar: "" });
    setPerguntas([]); setErro(""); clearEditing();
  };

  const handleIA = async () => {
    if (!nome.trim()) { setErro("Digite o nome da funcionalidade primeiro."); return; }
    setErro(""); setLoading(true);
    try {
      const out = await generate(nome.trim(), areaId);
      if (out.descricao) setDesc((d) => ({ ...d, ...out.descricao }));
      if (!codigo) setCodigo(slug(nome));
      const novas = (out.perguntas || []).map((p) => ({
        texto: p.pergunta || p.texto || "",
        disposicao: "usar",
        opcoes: (p.opcoes || []).map((o) => ({ texto: o.texto || "", veredito: VEREDITOS[o.veredito] ? o.veredito : "rever" })),
      }));
      setPerguntas((cur) => [...cur, ...novas]);
    } catch (e) {
      setErro("Não consegui gerar automaticamente. Preencha manualmente. (" + e.message + ")");
    } finally { setLoading(false); }
  };

  const addPerguntaManual = () =>
    setPerguntas((p) => [...p, { texto: "", disposicao: "usar", opcoes: [{ texto: "", veredito: "atende" }, { texto: "Outro", veredito: "rever" }] }]);
  const updPergunta = (i, patch) => setPerguntas((p) => p.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updOpcao = (pi, oi, patch) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: q.opcoes.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : q)));
  const addOpcao = (pi) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: [...q.opcoes, { texto: "", veredito: "atende" }] } : q)));
  const rmOpcao = (pi, oi) => setPerguntas((p) => p.map((q, k) => (k === pi ? { ...q, opcoes: q.opcoes.filter((_, j) => j !== oi) } : q)));
  const rmPergunta = (i) => setPerguntas((p) => p.filter((_, k) => k !== i));

  const salvar = () => {
    setErro("");
    if (!nome.trim()) { setErro("A funcionalidade precisa de um nome."); return; }

    // 1) Resolve segmento (existente ou novo)
    let segId = segmentoId, segmentosArr = segmentos;
    if (novoSegmento.trim()) { segId = uid(); segmentosArr = [...segmentos, { id: segId, nome: novoSegmento.trim() }]; }
    if (!segId) { setErro("Escolha ou crie um segmento."); return; }

    // 2) Resolve área dentro do segmento
    let aId = areaId, areas = base.areas;
    if (novaArea.trim()) { aId = uid(); areas = [...areas, { id: aId, nome: novaArea.trim(), segmento_id: segId }]; }
    if (!aId) { setErro("Escolha ou crie uma área no segmento."); return; }
    // Se escolheu área existente, garante que ela pertença ao segmento resolvido
    if (!novaArea.trim()) {
      const areaSel = areas.find((a) => a.id === aId);
      if (areaSel && areaSel.segmento_id !== segId) { setErro("A área escolhida não pertence a esse segmento."); return; }
    }

    const cod = codigo.trim() || slug(nome);
    const dup = base.funcionalidades.find((f) => f.codigo === cod && f.id !== editing);
    if (dup) { setErro(`O código "${cod}" já existe. Ajuste o código (ele é o elo único).`); return; }

    const usaveis = perguntas.filter((p) => p.disposicao !== "descartar" && p.texto.trim());
    let funcionalidades, perguntasArr, opcoesArr;

    if (editing) {
      const fid = editing;
      funcionalidades = base.funcionalidades.map((f) => f.id === fid ? { ...f, area_id: aId, codigo: cod, nome: nome.trim(), ...desc, atualizado_em: nowISO() } : f);
      const antigas = base.perguntas.filter((p) => p.funcionalidade_id === fid).map((p) => p.id);
      perguntasArr = base.perguntas.filter((p) => p.funcionalidade_id !== fid);
      opcoesArr = base.opcoes.filter((o) => !antigas.includes(o.pergunta_id));
      usaveis.forEach((p) => {
        const pid = uid();
        perguntasArr.push({ id: pid, funcionalidade_id: fid, texto: p.texto.trim(), origem: "humano", status: p.disposicao === "usar" ? "aprovada" : "sugerida", motivo: "", avaliado_por: "consultor", criado_em: nowISO() });
        p.opcoes.filter((o) => o.texto.trim()).forEach((o, idx) => opcoesArr.push({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), veredito: o.veredito, ordem: idx }));
      });
    } else {
      const fid = uid();
      funcionalidades = [...base.funcionalidades, { id: fid, area_id: aId, codigo: cod, nome: nome.trim(), ...desc, criado_em: nowISO(), atualizado_em: nowISO() }];
      perguntasArr = [...base.perguntas];
      opcoesArr = [...base.opcoes];
      usaveis.forEach((p) => {
        const pid = uid();
        perguntasArr.push({ id: pid, funcionalidade_id: fid, texto: p.texto.trim(), origem: "ia", status: p.disposicao === "usar" ? "aprovada" : "sugerida", motivo: "", avaliado_por: "consultor", criado_em: nowISO() });
        p.opcoes.filter((o) => o.texto.trim()).forEach((o, idx) => opcoesArr.push({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), veredito: o.veredito, ordem: idx }));
      });
    }
    saveBase({ ...base, segmentos: segmentosArr, areas, funcionalidades, perguntas: perguntasArr, opcoes: opcoesArr });
    setOk(true); setTimeout(() => setOk(false), 2500);
    resetForm();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="Escolha o segmento e a área, dê um nome à funcionalidade, deixe a IA sugerir e cure antes de salvar.">
        {editing ? "Editar funcionalidade" : "Cadastro de funcionalidade"}
      </SectionTitle>

      {ok && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2"><Check className="w-4 h-4" /> Salvo na base.</div>}
      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {erro}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Segmento</Label>
            <select className={inputCls} value={segmentoId} onChange={(e) => { setSegmentoId(e.target.value); setNovaArea(""); }}>
              {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <input className={inputCls + " mt-2"} placeholder="…ou crie um novo segmento" value={novoSegmento} onChange={(e) => setNovoSegmento(e.target.value)} />
          </div>
          <div>
            <Label>Área {novoSegmento.trim() && <span className="text-slate-400 normal-case">(crie uma abaixo p/ o novo segmento)</span>}</Label>
            <select className={inputCls} value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!!novoSegmento.trim()}>
              {areasDoSegmento.length === 0 && <option value="">— sem áreas nesse segmento —</option>}
              {areasDoSegmento.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <input className={inputCls + " mt-2"} placeholder="…ou crie uma nova área" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
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
            <Label>Código (elo único, slug)</Label>
            <input className={inputCls + " font-mono"} placeholder="auto a partir do nome" value={codigo} onChange={(e) => setCodigo(slug(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Descreve o resultado</span>
          <span className="text-xs text-slate-400">— não decide o veredito, escreve o relatório</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[["objetivo", "Objetivo"], ["fluxo", "Fluxo (passos)"], ["beneficio", "Benefício → ganho"], ["risco", "Risco → urgência"], ["limitacoes", "Limitações → gancho de custom"], ["cadastrar", "O que cadastrar"]].map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <textarea className={inputCls + " resize-y"} style={{ minHeight: 64 }} value={desc[k]} onChange={(e) => setDesc((d) => ({ ...d, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
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
