import { useState, useMemo, useRef, useEffect } from "react";
import { Gauge, Plus, Trash2, Check, X, ChevronRight, ListChecks, PencilLine, Play } from "lucide-react";
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
  const [modo, setModo] = useState("perguntas");
  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle sub="Estágio 1 · macro. O comercial roda para ler a maturidade da empresa e levantar as oportunidades (funcionalidades) do negócio.">
        Assessment de segmento
      </SectionTitle>
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {[["perguntas", "Perguntas", PencilLine], ["rodar", "Rodar assessment", Play]].map(([id, l, Icon]) => (
          <button key={id} onClick={() => setModo(id)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${modo === id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>
      {modo === "perguntas" ? <CadastroPerguntas base={base} saveBase={saveBase} /> : <RodarAssessment base={base} diag={diag} saveDiag={saveDiag} />}
    </div>
  );
}

/* ---------------- Cadastro de perguntas macro ---------------- */
function CadastroPerguntas({ base, saveBase }) {
  const segmentos = base.segmentos || [];
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [texto, setTexto] = useState("");
  const [opcoes, setOpcoes] = useState([{ texto: "", nivel: 4, oportunidades: [] }, { texto: "", nivel: 0, oportunidades: [] }]);
  const [erro, setErro] = useState("");

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
    const pid = uid();
    const novaP = { id: pid, segmento_id: segId, texto: texto.trim(), ordem: perguntas.length };
    const novasO = ops.map((o, idx) => ({ id: uid(), pergunta_id: pid, texto: o.texto.trim(), nivel: Number(o.nivel), oportunidades: o.oportunidades, ordem: idx }));
    saveBase({ ...base, assessmentPerguntas: [...(base.assessmentPerguntas || []), novaP], assessmentOpcoes: [...(base.assessmentOpcoes || []), ...novasO] });
    setTexto(""); setOpcoes([{ texto: "", nivel: 4, oportunidades: [] }, { texto: "", nivel: 0, oportunidades: [] }]);
  };

  const removerPergunta = (pid) => {
    if (!confirm("Remover esta pergunta e suas opções?")) return;
    saveBase({ ...base, assessmentPerguntas: base.assessmentPerguntas.filter((p) => p.id !== pid), assessmentOpcoes: base.assessmentOpcoes.filter((o) => o.pergunta_id !== pid) });
  };

  return (
    <div className="space-y-5">
      <div><Label>Segmento do questionário</Label>
        <select className={inputCls} value={segId} onChange={(e) => setSegId(e.target.value)}>
          {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      {perguntas.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400">Perguntas do segmento ({perguntas.length})</h3>
          {perguntas.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-800">{p.texto}</div>
                <button className="p-1 text-slate-400 hover:text-red-600" onClick={() => removerPergunta(p.id)}><Trash2 className="w-4 h-4" /></button>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="font-mono text-xs uppercase tracking-widest text-teal-700">Nova pergunta macro</h3>
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

        <div className="flex justify-end"><button className={btnTeal} onClick={salvar}><Check className="w-4 h-4" /> Salvar pergunta</button></div>
      </div>
    </div>
  );
}

/* ---------------- Rodar assessment + resultado ---------------- */
function RodarAssessment({ base, diag, saveDiag }) {
  const segmentos = base.segmentos || [];
  const [cliente, setCliente] = useState("");
  const [segId, setSegId] = useState(segmentos[0]?.id || "");
  const [sessao, setSessao] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState([]);
  const [resultado, setResultado] = useState(null);
  const scrollRef = useRef(null);

  const funcNome = (id) => base.funcionalidades.find((f) => f.id === id)?.nome || "—";
  const segNome = (id) => segmentos.find((s) => s.id === id)?.nome || "—";

  const perguntas = useMemo(() => {
    if (!sessao) return [];
    return (base.assessmentPerguntas || [])
      .filter((p) => p.segmento_id === sessao.segmento_id).sort((a, b) => a.ordem - b.ordem)
      .map((p) => ({ ...p, opcoes: (base.assessmentOpcoes || []).filter((o) => o.pergunta_id === p.id).sort((a, b) => a.ordem - b.ordem) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [picks, idx]);

  const iniciar = () => {
    if (!cliente.trim() || !segId) return;
    setSessao({ id: uid(), cliente_nome: cliente.trim(), segmento_id: segId, criado_em: nowISO() });
    setIdx(0); setPicks([]); setResultado(null);
  };

  const escolher = (op) => {
    const novas = [...picks, op];
    setPicks(novas);
    if (idx + 1 >= perguntas.length) finalizar(novas);
    else setIdx(idx + 1);
  };

  const finalizar = (novas) => {
    const niveis = novas.map((o) => o.nivel);
    const oportunidades = [...new Set(novas.flatMap((o) => o.oportunidades))];
    const r = calcularResultado(niveis);
    const registro = { id: sessao.id, cliente_nome: sessao.cliente_nome, segmento_id: sessao.segmento_id, criado_em: sessao.criado_em, status: "concluido", ...r, oportunidades };
    const respostas = novas.map((o) => ({ id: uid(), assessment_id: sessao.id, pergunta_id: o.pergunta_id, opcao_id: o.id, criado_em: nowISO() }));
    saveDiag({ ...diag, assessments: [...(diag.assessments || []), registro], assessmentRespostas: [...(diag.assessmentRespostas || []), ...respostas] });
    setResultado({ ...registro });
    setSessao(null);
  };

  // Tela de resultado
  if (resultado) {
    return (
      <div className="space-y-5">
        <div className="text-sm text-slate-500">{resultado.cliente_nome} · {segNome(resultado.segmento_id)} · {fmtDate(resultado.criado_em)}</div>
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
        <button className={btnGhost} onClick={() => { setResultado(null); setCliente(""); }}>Novo assessment</button>
      </div>
    );
  }

  // Tela de responder
  if (sessao) {
    if (perguntas.length === 0) {
      return (
        <div>
          <Empty icon={Gauge} title="Sem perguntas nesse segmento" hint="Cadastre perguntas na aba “Perguntas” antes de rodar." />
          <div className="text-center"><button className={btnGhost} onClick={() => setSessao(null)}>Voltar</button></div>
        </div>
      );
    }
    const p = perguntas[idx];
    const answered = picks.map((o, i) => ({ q: perguntas[i]?.texto, a: o.texto }));
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-800">{sessao.cliente_nome} <span className="text-xs text-slate-400 font-mono ml-1">{segNome(sessao.segmento_id)}</span></span>
          <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => setSessao(null)}>abandonar</button>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 mb-4 overflow-hidden"><div className="h-full bg-teal-600 transition-all" style={{ width: `${(idx / perguntas.length) * 100}%` }} /></div>
        <div ref={scrollRef} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "52vh" }}>
          {answered.map((a, i) => (
            <div key={i} className="space-y-2">
              <div className="text-sm text-slate-700 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-xs">{a.q}</div>
              <div className="flex justify-end"><div className="text-sm text-white bg-teal-700 rounded-2xl rounded-tr-sm px-4 py-2.5 inline-block max-w-xs">{a.a}</div></div>
            </div>
          ))}
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
        </div>
        <p className="text-center text-xs text-slate-400 mt-2 font-mono">{idx + 1} / {perguntas.length}</p>
      </div>
    );
  }

  // Tela inicial
  const anteriores = [...(diag.assessments || [])].reverse();
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div><Label>Cliente</Label><input className={inputCls} placeholder="Nome da empresa" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
        <div><Label>Segmento</Label>
          <select className={inputCls} value={segId} onChange={(e) => setSegId(e.target.value)}>{segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        </div>
        <button className={btnTeal} onClick={iniciar} disabled={!cliente.trim() || !segId}><Play className="w-4 h-4" /> Iniciar assessment</button>
      </div>
      {anteriores.length > 0 && (
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Assessments anteriores</h3>
          <div className="space-y-2">
            {anteriores.map((d) => (
              <button key={d.id} onClick={() => setResultado(d)} className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal-400 transition">
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
