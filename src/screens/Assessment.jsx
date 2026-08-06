import { useState, useMemo, useRef, useEffect } from "react";
import { Gauge, Plus, Trash2, Check, X, ChevronRight, ChevronUp, ChevronDown, ListChecks, PencilLine, Play, Building2, Layers } from "lucide-react";
import { uid, nowISO, fmtDate, inputCls, btnTeal, btnGhost, Label, Empty, SectionTitle } from "../ui.jsx";

const NIVEIS = [
  { v: 0, l: "Imaturo (0)" },
  { v: 1, l: "Inicial (1)" },
  { v: 2, l: "Em desenvolvimento (2)" },
  { v: 3, l: "Gerenciado (3)" },
  { v: 4, l: "Maduro (4)" },
];
const nivelLabel = (v) => (NIVEIS.find((n) => n.v === Number(v)) || {}).l || `nível ${v}`;

// Estágio 1 é honesto: só o que dá pra afirmar sem o técnico.
// Maturidade = da empresa (níveis 0-4). As oportunidades (com sua contagem) falam por si.
// Risco NÃO mora aqui — nasce no cruzamento com o diagnóstico técnico (fatia 3),
// como soma ponderada por veredito: gap 1,0 · parcial 0,4 · custom 0,5 · parceira 0,25 · atende/ok 0.
export function calcularResultado(niveis) {
  const maturidade = niveis.length ? Math.round((niveis.reduce((a, b) => a + b, 0) / (niveis.length * 4)) * 100) : 0;
  return { maturidade };
}

export default function Assessment({ base, saveBase, diag, saveDiag }) {
  const [modo, setModo] = useState("configurar");
  const segmentos = base.segmentos || [];
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [novoSeg, setNovoSeg] = useState("");
  const segAtual = segmentos.find((s) => s.id === segId);

  const criarSegmento = () => {
    const nome = novoSeg.trim();
    if (!nome) return;
    const id = uid();
    saveBase({ ...base, segmentos: [...segmentos, { id, nome }] });
    setSegId(id); setNovoSeg("");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="Estágio 1 · macro. O comercial roda para ler a maturidade da empresa e levantar as oportunidades (funcionalidades) do negócio.">
        Assessment de segmento
      </SectionTitle>
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {[["configurar", "Configurar", PencilLine], ["rodar", "Rodar assessment", Play]].map(([id, l, Icon]) => (
          <button key={id} onClick={() => setModo(id)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${modo === id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>
      {modo === "configurar" && (
        <div className="space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-teal-900 flex items-center gap-2"><Layers className="w-4 h-4" /> Segmento</h3>
            <p className="text-xs text-slate-400 -mt-2">O segmento define as perguntas deste assessment e agrupa suas funcionalidades. Os campos da empresa são globais (valem para todos).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Segmento em edição</Label>
                <select className={inputCls} value={segId} onChange={(e) => setSegId(e.target.value)}>
                  {segmentos.length === 0 && <option value="">— nenhum ainda —</option>}
                  {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <Label>Criar novo segmento</Label>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="ex.: Logística" value={novoSeg} onChange={(e) => setNovoSeg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && criarSegmento()} />
                  <button className={btnTeal + " whitespace-nowrap"} onClick={criarSegmento} disabled={!novoSeg.trim()}><Plus className="w-4 h-4" /> Criar</button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8">
            <h3 className="text-sm font-semibold text-teal-900 mb-3 flex items-center gap-2"><PencilLine className="w-4 h-4" /> Perguntas do assessment {segAtual && <span className="text-slate-400 font-normal">· {segAtual.nome}</span>}</h3>
            {segAtual ? <CadastroPerguntas base={base} saveBase={saveBase} segId={segId} /> : <p className="text-sm text-slate-400">Crie um segmento acima para cadastrar perguntas.</p>}
          </div>

          <div className="border-t border-slate-200 pt-8">
            <h3 className="text-sm font-semibold text-teal-900 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Dados da empresa <span className="text-slate-400 font-normal">· globais (preenchidos ao rodar)</span></h3>
            <CamposEmpresa base={base} saveBase={saveBase} />
          </div>
        </div>
      )}
      {modo === "rodar" && <RodarAssessment base={base} diag={diag} saveDiag={saveDiag} />}
    </div>
  );
}

const camposOrdenados = (base) => [...(base.camposEmpresa || [])].sort((a, b) => a.ordem - b.ordem);
const TIPOS = [["texto", "Texto"], ["numero", "Número"], ["selecao", "Seleção"]];

// Renderiza o input de um campo da empresa conforme o tipo.
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

/* ---------------- Editor de campos da empresa (ficha) ---------------- */
function CamposEmpresa({ base, saveBase }) {
  const campos = camposOrdenados(base);
  const [label, setLabel] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [opcoesTxt, setOpcoesTxt] = useState("");
  const [obrigatorio, setObrigatorio] = useState(false);
  const [erro, setErro] = useState("");
  const [editId, setEditId] = useState(null);
  const [ed, setEd] = useState({ label: "", tipo: "texto", opcoesTxt: "", obrigatorio: false });

  const tipoLabel = (t) => TIPOS.find((x) => x[0] === t)?.[1] || t;

  const salvar = () => {
    setErro("");
    if (!label.trim()) { setErro("Dê um nome ao campo."); return; }
    const opcoes = tipo === "selecao" ? opcoesTxt.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (tipo === "selecao" && opcoes.length < 2) { setErro("Seleção precisa de ao menos 2 opções (separadas por vírgula)."); return; }
    const novo = { id: uid(), label: label.trim(), tipo, opcoes, obrigatorio, ordem: campos.length };
    saveBase({ ...base, camposEmpresa: [...(base.camposEmpresa || []), novo] });
    setLabel(""); setTipo("texto"); setOpcoesTxt(""); setObrigatorio(false);
  };
  const remover = (id) => {
    if (!confirm("Remover este campo? Os assessments já rodados mantêm o valor guardado.")) return;
    saveBase({ ...base, camposEmpresa: base.camposEmpresa.filter((c) => c.id !== id) });
    if (editId === id) setEditId(null);
  };
  const mover = (id, dir) => {
    const arr = camposOrdenados(base);
    const i = arr.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const sw = [...arr];
    [sw[i], sw[j]] = [sw[j], sw[i]];
    saveBase({ ...base, camposEmpresa: sw.map((c, k) => ({ ...c, ordem: k })) });
  };
  const abrirEdicao = (c) => { setErro(""); setEditId(c.id); setEd({ label: c.label, tipo: c.tipo, opcoesTxt: (c.opcoes || []).join(", "), obrigatorio: !!c.obrigatorio }); };
  const salvarEdicao = () => {
    setErro("");
    if (!ed.label.trim()) { setErro("Dê um nome ao campo."); return; }
    const opcoes = ed.tipo === "selecao" ? ed.opcoesTxt.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (ed.tipo === "selecao" && opcoes.length < 2) { setErro("Seleção precisa de ao menos 2 opções."); return; }
    saveBase({ ...base, camposEmpresa: base.camposEmpresa.map((c) => c.id === editId ? { ...c, label: ed.label.trim(), tipo: ed.tipo, opcoes, obrigatorio: ed.obrigatorio } : c) });
    setEditId(null);
  };

  const iconBtn = "p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Campos que você preenche sobre a empresa ao rodar. Valem para todos os segmentos.</p>

      {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}

      {campos.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {campos.map((c, i) => editId === c.id ? (
            <div key={c.id} className="p-3 bg-teal-50/40 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input className={inputCls} value={ed.label} onChange={(e) => setEd((s) => ({ ...s, label: e.target.value }))} placeholder="Nome do campo" />
                <select className={inputCls + " sm:w-40"} value={ed.tipo} onChange={(e) => setEd((s) => ({ ...s, tipo: e.target.value }))}>
                  {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {ed.tipo === "selecao" && <input className={inputCls} value={ed.opcoesTxt} onChange={(e) => setEd((s) => ({ ...s, opcoesTxt: e.target.value }))} placeholder="Opções separadas por vírgula" />}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-teal-600" checked={ed.obrigatorio} onChange={(e) => setEd((s) => ({ ...s, obrigatorio: e.target.checked }))} /> Obrigatório</label>
                <div className="flex gap-2">
                  <button className={btnGhost + " !py-1.5"} onClick={() => setEditId(null)}>Cancelar</button>
                  <button className={btnTeal + " !py-1.5"} onClick={salvarEdicao}><Check className="w-4 h-4" /> Salvar</button>
                </div>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{c.label}</span>
              <span className="font-mono text-[11px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{tipoLabel(c.tipo)}</span>
              {c.obrigatorio && <span className="text-[11px] text-red-500">obrigatório</span>}
              {c.tipo === "selecao" && <span className="text-xs text-slate-400 truncate">{c.opcoes.join(" · ")}</span>}
              <div className="ml-auto flex items-center gap-0.5">
                <button className={iconBtn} onClick={() => mover(c.id, -1)} disabled={i === 0} title="Subir"><ChevronUp className="w-4 h-4" /></button>
                <button className={iconBtn} onClick={() => mover(c.id, 1)} disabled={i === campos.length - 1} title="Descer"><ChevronDown className="w-4 h-4" /></button>
                <button className={iconBtn} onClick={() => abrirEdicao(c)} title="Editar"><PencilLine className="w-4 h-4" /></button>
                <button className={iconBtn + " hover:!text-red-600"} onClick={() => remover(c.id)} title="Remover"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <span className="font-mono text-xs uppercase tracking-widest text-teal-700">Novo campo</span>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={inputCls} placeholder="Nome do campo (ex.: faturamento anual)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select className={inputCls + " sm:w-40"} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {tipo === "selecao" && (
          <input className={inputCls} placeholder="Opções separadas por vírgula: Simples Nacional, Lucro Presumido, Lucro Real" value={opcoesTxt} onChange={(e) => setOpcoesTxt(e.target.value)} />
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-teal-600" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} /> Obrigatório ao rodar</label>
          <button className={btnTeal} onClick={salvar}><Plus className="w-4 h-4" /> Adicionar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cadastro de perguntas macro ---------------- */
function CadastroPerguntas({ base, saveBase, segId }) {
  const [texto, setTexto] = useState("");
  const [opcoes, setOpcoes] = useState([{ texto: "", nivel: 4, oportunidades: [] }, { texto: "", nivel: 0, oportunidades: [] }]);
  const [erro, setErro] = useState("");
  const [editId, setEditId] = useState(null);
  const formRef = useRef(null);

  const perguntas = (base.assessmentPerguntas || []).filter((p) => p.segmento_id === segId).sort((a, b) => a.ordem - b.ordem);
  const opcoesDe = (pid) => (base.assessmentOpcoes || []).filter((o) => o.pergunta_id === pid).sort((a, b) => a.ordem - b.ordem);
  const funcsDoSegmento = base.funcionalidades.filter((f) => {
    const area = base.areas.find((a) => a.id === f.area_id);
    return area && area.segmento_id === segId;
  });
  const funcNome = (id) => base.funcionalidades.find((f) => f.id === id)?.nome || "—";

  const updOp = (i, patch) => setOpcoes((o) => o.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const toggleOportunidade = (i, fid) => setOpcoes((o) => o.map((x, k) => k === i ? { ...x, oportunidades: x.oportunidades.includes(fid) ? x.oportunidades.filter((y) => y !== fid) : [...x.oportunidades, fid] } : x));
  const addOp = () => setOpcoes((o) => [...o, { texto: "", nivel: 2, oportunidades: [] }]);
  const rmOp = (i) => setOpcoes((o) => o.filter((_, k) => k !== i));

  const salvar = () => {
    setErro("");
    if (!segId) { setErro("Escolha um segmento."); return; }
    if (!texto.trim()) { setErro("Escreva o texto da pergunta."); return; }
    const ops = opcoes.filter((o) => o.texto.trim());
    if (ops.length < 2) { setErro("A pergunta precisa de ao menos 2 opções com texto."); return; }
    if (editId) {
      const perguntasArr = base.assessmentPerguntas.map((p) => p.id === editId ? { ...p, texto: texto.trim() } : p);
      const semAntigas = base.assessmentOpcoes.filter((o) => o.pergunta_id !== editId);
      const novasO = ops.map((o, idx) => ({ id: uid(), pergunta_id: editId, texto: o.texto.trim(), nivel: Number(o.nivel), oportunidades: o.oportunidades, ordem: idx }));
      saveBase({ ...base, assessmentPerguntas: perguntasArr, assessmentOpcoes: [...semAntigas, ...novasO] });
    } else {
      const pid = uid();
      const novaP = { id: pid, segmento_id: segId, texto: texto.trim(), ordem: perguntas.length };
      const novasO = ops.map((o, idx) => ({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), nivel: Number(o.nivel), oportunidades: o.oportunidades, ordem: idx }));
      saveBase({ ...base, assessmentPerguntas: [...(base.assessmentPerguntas || []), novaP], assessmentOpcoes: [...(base.assessmentOpcoes || []), ...novasO] });
    }
    limparForm();
  };
  const limparForm = () => { setTexto(""); setOpcoes([{ texto: "", nivel: 4, oportunidades: [] }, { texto: "", nivel: 0, oportunidades: [] }]); setEditId(null); };
  const editar = (p) => {
    setErro(""); setEditId(p.id); setTexto(p.texto);
    setOpcoes(opcoesDe(p.id).map((o) => ({ texto: o.texto, nivel: o.nivel, oportunidades: [...(o.oportunidades || [])] })));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const removerPergunta = (pid) => {
    if (!confirm("Remover esta pergunta e suas opções?")) return;
    saveBase({ ...base, assessmentPerguntas: base.assessmentPerguntas.filter((p) => p.id !== pid), assessmentOpcoes: base.assessmentOpcoes.filter((o) => o.pergunta_id !== pid) });
    if (editId === pid) limparForm();
  };

  return (
    <div className="space-y-5">
      {perguntas.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400">Perguntas do segmento ({perguntas.length})</h3>
          {perguntas.map((p) => (
            <div key={p.id} className={`rounded-xl border p-4 ${editId === p.id ? "border-teal-400 ring-1 ring-teal-200" : "border-slate-200"} bg-white`}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-800">{p.texto}</div>
                <div className="flex gap-1 shrink-0">
                  <button className="p-1 text-slate-400 hover:text-teal-700" onClick={() => editar(p)} title="Editar"><PencilLine className="w-4 h-4" /></button>
                  <button className="p-1 text-slate-400 hover:text-red-600" onClick={() => removerPergunta(p.id)} title="Remover"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {opcoesDe(p.id).map((o) => (
                  <div key={o.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-mono bg-slate-100 rounded px-1.5 py-0.5">{nivelLabel(o.nivel)}</span>
                    <span className="flex-1">{o.texto}</span>
                    {o.oportunidades.length > 0 && <span className="text-teal-700">{o.oportunidades.map(funcNome).join(", ")}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={formRef} className={`rounded-2xl border bg-white p-5 space-y-4 ${editId ? "border-teal-400" : "border-slate-200"}`}>
        <h3 className="font-mono text-xs uppercase tracking-widest text-teal-700">{editId ? "Editar pergunta" : "Nova pergunta macro"}</h3>
        {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}
        <div><Label>Pergunta</Label><input className={inputCls} placeholder="ex.: Como a empresa acompanha a produção hoje?" value={texto} onChange={(e) => setTexto(e.target.value)} /></div>

        <div className="space-y-3">
          <Label>Opções (cada uma tem um grau de maturidade e pode acender oportunidades)</Label>
          {opcoes.map((o, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input className={inputCls} placeholder="Texto da opção" value={o.texto} onChange={(e) => updOp(i, { texto: e.target.value })} />
                <select title="Grau de maturidade da resposta" className="rounded-lg border border-slate-300 px-2 py-2 text-xs outline-none focus:border-teal-500" style={{ minWidth: 150 }} value={o.nivel} onChange={(e) => updOp(i, { nivel: e.target.value })}>
                  {NIVEIS.map((n) => <option key={n.v} value={n.v}>{n.l}</option>)}
                </select>
                <button className="p-2 text-slate-400 hover:text-red-600" onClick={() => rmOp(i)}><X className="w-4 h-4" /></button>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Acende quais funcionalidades? {funcsDoSegmento.length === 0 && <span>— nenhuma cadastrada nesse segmento ainda</span>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {funcsDoSegmento.map((f) => {
                    const on = o.oportunidades.includes(f.id);
                    return (
                      <button key={f.id} onClick={() => toggleOportunidade(i, f.id)}
                        className={`text-xs rounded-full px-2.5 py-1 border transition ${on ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-300 hover:border-teal-400"}`}>
                        {on && <Check className="w-3 h-3 inline mr-1" />}{f.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={addOp}><Plus className="w-3 h-3" /> opção</button>
        </div>

        <div className="flex justify-end gap-2">
          {editId && <button className={btnGhost} onClick={limparForm}>Cancelar</button>}
          <button className={btnTeal} onClick={salvar}><Check className="w-4 h-4" /> {editId ? "Salvar alterações" : "Salvar pergunta"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Rodar assessment + resultado ---------------- */
function RodarAssessment({ base, diag, saveDiag }) {
  const segmentos = base.segmentos || [];
  const [cliente, setCliente] = useState("");
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [dados, setDados] = useState({});
  const [erro, setErro] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [resultado, setResultado] = useState(null);
  const scrollRef = useRef(null);

  const funcNome = (id) => base.funcionalidades.find((f) => f.id === id)?.nome || "—";
  const segNome = (id) => segmentos.find((s) => s.id === id)?.nome || "—";
  const perguntaById = (id) => (base.assessmentPerguntas || []).find((p) => p.id === id);
  const opById = (id) => (base.assessmentOpcoes || []).find((o) => o.id === id);
  const opcoesDe = (pid) => (base.assessmentOpcoes || []).filter((o) => o.pergunta_id === pid).sort((a, b) => a.ordem - b.ordem);

  const assessments = diag.assessments || [];
  const emAndamento = assessments.filter((a) => a.status === "em_andamento");
  const concluidos = assessments.filter((a) => a.status !== "em_andamento");

  const sessao = activeId ? assessments.find((a) => a.id === activeId && a.status === "em_andamento") : null;

  // Perguntas da sessão: snapshot congelado (perguntaIds), na ordem salva.
  const perguntas = sessao
    ? (sessao.perguntaIds || []).map((pid) => perguntaById(pid)).filter(Boolean).map((p) => ({ ...p, opcoes: opcoesDe(p.id) }))
    : [];
  const respostasSessao = sessao ? (diag.assessmentRespostas || []).filter((r) => r.assessment_id === sessao.id) : [];
  const idx = respostasSessao.length;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [idx, activeId]);

  const perguntasDoSegmento = (sid) => (base.assessmentPerguntas || []).filter((p) => p.segmento_id === sid).sort((a, b) => a.ordem - b.ordem).map((p) => p.id);

  const iniciar = () => {
    setErro("");
    if (!cliente.trim() || !segId) return;
    const faltando = camposOrdenados(base).filter((c) => c.obrigatorio && !String(dados[c.id] || "").trim());
    if (faltando.length) { setErro("Preencha os campos obrigatórios: " + faltando.map((c) => c.label).join(", ") + "."); return; }
    const perguntaIds = perguntasDoSegmento(segId);
    if (perguntaIds.length === 0) { setErro("Esse segmento ainda não tem perguntas. Cadastre em “Configurar”."); return; }
    const rec = { id: uid(), cliente_nome: cliente.trim(), segmento_id: segId, dados: { ...dados }, criado_em: nowISO(), status: "em_andamento", perguntaIds };
    saveDiag({ ...diag, assessments: [...assessments, rec] });
    setActiveId(rec.id); setResultado(null);
    setCliente(""); setDados({});
  };

  const escolher = (op) => {
    const novaResp = { id: uid(), assessment_id: sessao.id, pergunta_id: perguntas[idx].id, opcao_id: op.id, criado_em: nowISO() };
    const todas = [...respostasSessao, novaResp];
    const ultima = todas.length >= perguntas.length;
    let novosAssessments = assessments;
    let concluido = null;
    if (ultima) {
      const opts = todas.map((r) => opById(r.opcao_id));
      const niveis = opts.map((o) => (o ? o.nivel : 0));
      const oportunidades = [...new Set(opts.flatMap((o) => (o ? o.oportunidades : [])))];
      const r = calcularResultado(niveis);
      novosAssessments = assessments.map((a) => a.id === sessao.id ? { ...a, status: "concluido", ...r, oportunidades } : a);
      concluido = novosAssessments.find((a) => a.id === sessao.id);
    }
    saveDiag({ ...diag, assessments: novosAssessments, assessmentRespostas: [...(diag.assessmentRespostas || []), novaResp] });
    if (ultima) { setResultado(concluido); setActiveId(null); }
  };

  const incluirNovas = () => {
    const novas = perguntasDoSegmento(sessao.segmento_id).filter((pid) => !(sessao.perguntaIds || []).includes(pid));
    if (!novas.length) return;
    const novosAssessments = assessments.map((a) => a.id === sessao.id ? { ...a, perguntaIds: [...a.perguntaIds, ...novas] } : a);
    saveDiag({ ...diag, assessments: novosAssessments });
  };

  const descartar = (rec) => {
    if (!confirm("Descartar esta execução e suas respostas?")) return;
    saveDiag({
      ...diag,
      assessments: assessments.filter((a) => a.id !== rec.id),
      assessmentRespostas: (diag.assessmentRespostas || []).filter((r) => r.assessment_id !== rec.id),
    });
    if (activeId === rec.id) setActiveId(null);
  };

  // ---- Tela de resultado ----
  if (resultado) {
    return (
      <div className="space-y-5">
        <div className="text-sm text-slate-500">{resultado.cliente_nome} · {segNome(resultado.segmento_id)} · {fmtDate(resultado.criado_em)}</div>
        {camposOrdenados(base).some((c) => resultado.dados?.[c.id]) && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Dados da empresa</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {camposOrdenados(base).filter((c) => resultado.dados?.[c.id]).map((c) => (
                <div key={c.id} className="flex justify-between text-sm border-b border-slate-100 py-1">
                  <span className="text-slate-500">{c.label}</span><span className="text-slate-800 font-medium">{resultado.dados[c.id]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl bg-slate-50 p-4 max-w-xs"><div className="text-xs text-slate-500 mb-1">Maturidade da empresa</div><div className="text-2xl font-semibold text-teal-800">{resultado.maturidade}<span className="text-sm text-slate-400">/100</span></div></div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Oportunidades acesas ({resultado.oportunidades.length})</h3>
          {resultado.oportunidades.length === 0 ? <p className="text-sm text-slate-400">Nenhuma lacuna apontada nas dimensões avaliadas.</p>
            : <div className="space-y-2">
              {resultado.oportunidades.map((fid) => (
                <div key={fid} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <ListChecks className="w-4 h-4 text-teal-600" /><span className="text-slate-700">{funcNome(fid)}</span>
                  <span className="ml-auto text-xs font-mono text-slate-400">oportunidade</span>
                </div>
              ))}
            </div>}
          {resultado.oportunidades.length > 0 && <p className="text-xs text-slate-400 mt-2">Na próxima fatia, estas viram a seleção do diagnóstico técnico (estágio 2).</p>}
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Respostas do assessment</h3>
          <div className="space-y-2">
            {(diag.assessmentRespostas || []).filter((r) => r.assessment_id === resultado.id).map((r) => {
              const op = opById(r.opcao_id);
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-sm text-slate-500">{perguntaById(r.pergunta_id)?.texto || "(pergunta removida)"}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-slate-800 font-medium">{op?.texto || "(opção removida)"}</span>
                    {op && <span className="font-mono text-[11px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{nivelLabel(op.nivel)}</span>}
                    {op && op.oportunidades?.length > 0 && <span className="text-xs text-teal-700">→ {op.oportunidades.map(funcNome).join(", ")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button className={btnGhost} onClick={() => { setResultado(null); }}>Novo assessment</button>
      </div>
    );
  }

  // ---- Tela de responder ----
  if (sessao) {
    if (perguntas.length === 0) {
      return (
        <div>
          <Empty icon={Gauge} title="Sem perguntas nesse segmento" hint="Cadastre perguntas em “Configurar” antes de rodar." />
          <div className="text-center"><button className={btnGhost} onClick={() => setActiveId(null)}>Voltar</button></div>
        </div>
      );
    }
    const concluiu = idx >= perguntas.length;
    const p = perguntas[Math.min(idx, perguntas.length - 1)];
    const answered = respostasSessao.map((r) => ({ q: perguntaById(r.pergunta_id)?.texto, a: opById(r.opcao_id)?.texto || "(opção removida)" }));
    const novasDisponiveis = perguntasDoSegmento(sessao.segmento_id).filter((pid) => !(sessao.perguntaIds || []).includes(pid)).length;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-800">{sessao.cliente_nome} <span className="text-xs text-slate-400 font-mono ml-1">{segNome(sessao.segmento_id)}</span></span>
          <div className="flex items-center gap-3">
            {novasDisponiveis > 0 && <button className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1" onClick={incluirNovas}><Plus className="w-3 h-3" /> incluir {novasDisponiveis} nova{novasDisponiveis > 1 ? "s" : ""}</button>}
            <button className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setActiveId(null)} title="Sai e mantém salvo para continuar depois">pausar</button>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => descartar(sessao)}>descartar</button>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 mb-4 overflow-hidden"><div className="h-full bg-teal-600 transition-all" style={{ width: `${(idx / perguntas.length) * 100}%` }} /></div>
        <div ref={scrollRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "52vh" }}>
          {answered.map((a, i) => (
            <div key={i} className="space-y-2">
              <div className="text-sm text-slate-700 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs">{a.q}</div>
              <div className="flex justify-end"><div className="text-sm text-white bg-teal-700 rounded-2xl rounded-tr-sm px-4 py-2.5 inline-block max-w-xs">{a.a}</div></div>
            </div>
          ))}
          {!concluiu && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-slate-800 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs font-medium">{p.texto}</div>
              <div className="grid gap-2">
                {p.opcoes.map((o) => (
                  <button key={o.id} onClick={() => escolher(o)} className="text-left text-sm rounded-xl border border-slate-300 px-4 py-2.5 hover:border-teal-500 hover:bg-teal-50 transition flex items-center justify-between group">
                    <span className="text-slate-700">{o.texto}</span><ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-2 font-mono">{Math.min(idx, perguntas.length)} / {perguntas.length}</p>
      </div>
    );
  }

  // ---- Tela inicial ----
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        {erro && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>}
        <div><Label>Cliente</Label><input className={inputCls} placeholder="Nome da empresa" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
        <div><Label>Segmento</Label>
          <select className={inputCls} value={segId} onChange={(e) => setSegId(e.target.value)}>{segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        </div>
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
        <button className={btnTeal} onClick={iniciar} disabled={!cliente.trim() || !segId}><Play className="w-4 h-4" /> Iniciar assessment</button>
      </div>

      {emAndamento.length > 0 && (
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-amber-600 mb-2">Em andamento ({emAndamento.length})</h3>
          <div className="space-y-2">
            {[...emAndamento].reverse().map((d) => {
              const total = (d.perguntaIds || []).length;
              const feitas = (diag.assessmentRespostas || []).filter((r) => r.assessment_id === d.id).length;
              return (
                <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                      <div className="text-xs text-slate-400 font-mono">{segNome(d.segmento_id)} · {feitas}/{total} respondidas · {fmtDate(d.criado_em)}</div>
                    </div>
                    <button className={btnTeal + " !py-1.5"} onClick={() => { setResultado(null); setActiveId(d.id); }}><Play className="w-3.5 h-3.5" /> Continuar</button>
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
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Assessments concluídos</h3>
          <div className="space-y-2">
            {[...concluidos].reverse().map((d) => (
              <button key={d.id} onClick={() => { setActiveId(null); setResultado(d); }} className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal-400 transition">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{d.cliente_nome}</div>
                  <div className="text-xs text-slate-400 font-mono">{segNome(d.segmento_id)} · maturidade {d.maturidade} · {d.oportunidades?.length || 0} oportunidades · {fmtDate(d.criado_em)}</div>
                </div>
                <Gauge className="w-4 h-4 text-teal-600" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
