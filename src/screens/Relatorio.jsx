import { useState, useEffect, useMemo } from "react";
import { FileText, Copy, Check, Edit3, Save, RotateCcw, Clock, ListChecks, Pencil, Paperclip } from "lucide-react";
import { VEREDITOS, VEREDITO_ORDER, fmtDate, tipoAnexo, btnTeal, btnGhost, VeredictoChip, Field, Label, Empty, SectionTitle } from "../ui.jsx";

function AnexoView({ a }) {
  const t = tipoAnexo(a.tipo);
  if (t === "image") return <a href={a.url} target="_blank" rel="noreferrer" title={a.nome}><img src={a.url} alt={a.nome} className="h-16 w-16 object-cover rounded-lg border border-slate-200" /></a>;
  if (t === "audio") return <audio controls src={a.url} className="h-9" />;
  return <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline border border-slate-200 rounded-lg px-2 py-1 bg-white"><Paperclip className="w-3.5 h-3.5" />{a.nome}</a>;
}

function Anexos({ lista }) {
  if (!lista || !lista.length) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-2">{lista.map((a) => <AnexoView key={a.id} a={a} />)}</div>;
}

// Ordem das linhas técnicas: do mais crítico ao melhor. "Rever" aparece antes, em bloco próprio.
const ORDEM_TECNICA = ["gap", "custom", "parcial", "parceira", "atende", "ok"];

// Lado "Como podemos atender" — tom consultivo por veredito.
function comoAtendemos(it) {
  switch (it.veredito) {
    case "atende": return it.f?.como_atende?.trim() || "Atendemos esse processo de forma nativa, sem esforço adicional.";
    case "ok": return "Já bem resolvido no cliente — sem esforço de implantação da nossa parte.";
    case "parceira": return "Atendemos por meio de parceiro/integração homologada.";
    case "parcial": return "Atendemos parcialmente; resta um ajuste a dimensionar no projeto.";
    case "custom": return "Atendemos via customização — escopo a dimensionar em conjunto.";
    case "gap": return "Hoje não cobrimos isso nativamente; ponto a avaliar como evolução/roadmap.";
    default: return "";
  }
}

export default function Relatorio({ base, diag, saveDiag, selectedId, setSelectedId, goToPlano, goToDiagnostico }) {
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [notaEdit, setNotaEdit] = useState(null);
  const [notaTxt, setNotaTxt] = useState("");
  const diags = [...diag.diagnosticos].filter((x) => x.status !== "em_andamento").reverse();
  const d = diag.diagnosticos.find((x) => x.id === selectedId) || diags[0];
  const areaNome = (id) => base.areas.find((a) => a.id === id)?.nome || "—";
  const escopoLabel = (x) => x?.escopo_label || (x?.area_id ? "Área · " + areaNome(x.area_id) : "—");

  const dados = useMemo(() => {
    if (!d) return null;
    const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
    const itens = rs.map((r) => {
      const o = base.opcoes.find((x) => x.id === r.opcao_id);
      const p = base.perguntas.find((x) => x.id === r.pergunta_id);
      const f = base.funcionalidades.find((x) => x.id === p?.funcionalidade_id);
      return { r, o, p, f, veredito: o?.veredito || "rever" };
    });
    const grupos = {}; VEREDITO_ORDER.forEach((v) => (grupos[v] = []));
    const outros = [];
    itens.forEach((it) => { if (it.veredito === "rever") outros.push(it); else grupos[it.veredito].push(it); });
    const contagem = {}; ["ok", "atende", "parceira", "parcial", "custom", "gap", "rever"].forEach((v) => (contagem[v] = 0));
    itens.forEach((it) => (contagem[it.veredito] = (contagem[it.veredito] || 0) + 1));
    return { itens, grupos, outros, contagem };
  }, [d, diag.respostas, base]);

  // Risco de implantação: vem só dos vereditos técnicos. atende/ok = 0.
  const risco = useMemo(() => {
    if (!dados) return null;
    const P = { gap: 1, custom: 0.5, parcial: 0.4, parceira: 0.25, atende: 0, ok: 0 };
    const c = dados.contagem;
    const avaliados = c.gap + c.custom + c.parcial + c.parceira + c.atende + c.ok; // exclui "rever" (Outro)
    if (!avaliados) return null;
    const soma = c.gap * P.gap + c.custom * P.custom + c.parcial * P.parcial + c.parceira * P.parceira;
    const pct = Math.round((soma / avaliados) * 100);
    const faixa = pct >= 60 ? "Alto" : pct >= 30 ? "Médio" : "Baixo";
    const partes = [];
    if (c.gap) partes.push(`${c.gap} não atende`);
    if (c.custom) partes.push(`${c.custom} customização${c.custom > 1 ? "ões" : ""}`);
    if (c.parcial) partes.push(`${c.parcial} parcial${c.parcial > 1 ? "is" : ""}`);
    if (c.parceira) partes.push(`${c.parceira} via parceiro`);
    return { pct, faixa, avaliados, partes };
  }, [dados]);

  useEffect(() => { setEditMode(false); setDraft(null); }, [d?.id]);

  if (!d) return <div className="max-w-3xl mx-auto"><Empty icon={FileText} title="Nenhum diagnóstico ainda" hint="Rode um diagnóstico no bot para gerar o relatório." /></div>;

  const linhas = dados ? dados.itens.filter((it) => it.veredito !== "rever").slice().sort((a, b) => ORDEM_TECNICA.indexOf(a.veredito) - ORDEM_TECNICA.indexOf(b.veredito)) : [];

  // Dados da empresa (snapshot do diagnóstico, com fallback na empresa vinculada)
  const dadosEmpresa = (d && (d.dados || (diag.empresas || []).find((e) => e.id === d.empresa_id)?.dados)) || {};
  const campos = [...(base.camposEmpresa || [])].sort((a, b) => a.ordem - b.ordem).filter((c) => String(dadosEmpresa[c.id] || "").trim());

  // Oportunidades (das perguntas iniciais) × o que o técnico concluiu sobre cada funcionalidade
  const CRIT = ["gap", "custom", "parcial", "parceira", "atende", "ok"]; // do mais crítico ao melhor
  const vereditoPorFunc = {};
  (dados?.itens || []).forEach((it) => {
    const fid = it.f?.id; if (!fid) return;
    if (!(fid in vereditoPorFunc) || CRIT.indexOf(it.veredito) < CRIT.indexOf(vereditoPorFunc[fid])) vereditoPorFunc[fid] = it.veredito;
  });
  const funcNome = (id) => base.funcionalidades.find((f) => f.id === id)?.nome || "—";
  const notas = d?.notasVeredito || {};
  const salvarNota = (v, txt) => {
    const nv = { ...notas, [v]: txt.trim() ? txt.trim() : undefined };
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => x.id === d.id ? { ...x, notasVeredito: nv } : x) });
  };
  const anexosIniciais = (diag.respostas || [])
    .filter((r) => r.diagnostico_id === d.id && r.tipo === "inicial" && r.anexos && r.anexos.length)
    .map((r) => ({ id: r.id, pergunta: (base.assessmentPerguntas || []).find((x) => x.id === r.pergunta_id)?.texto || "Pergunta inicial", anexos: r.anexos }));
  const oportunidades = (d?.oportunidades || []);
  const maturidade = d?.maturidade;
  const matFaixa = maturidade == null ? null
    : maturidade >= 67 ? { l: "Madura", cor: "emerald" }
    : maturidade >= 34 ? { l: "Em evolução", cor: "amber" }
    : { l: "Baixa", cor: "red" };
  const cruzamentoLabel = (v) => {
    switch (v) {
      case "gap": return "lacuna nossa hoje → oportunidade forte";
      case "custom": return "atendemos via customização";
      case "parcial": return "atendemos parcialmente";
      case "parceira": return "atendemos via parceiro";
      case "atende": case "ok": return "já atendemos";
      default: return "não avaliada no diagnóstico técnico";
    }
  };
  const sintese = (() => {
    if (!dados) return "";
    const c = dados.contagem;
    const avaliados = c.atende + c.ok + c.parceira + c.parcial + c.custom + c.gap;
    if (!avaliados) return "Nenhum processo avaliado ainda.";
    const diretos = c.atende + c.ok, ressalva = c.parceira + c.parcial + c.custom;
    let s = `De ${avaliados} processo${avaliados > 1 ? "s" : ""} avaliado${avaliados > 1 ? "s" : ""}, atendemos ${diretos} diretamente`;
    if (ressalva) s += `, ${ressalva} com ressalva (parceiro, parcial ou customização)`;
    if (c.gap) s += ` e ${c.gap} é${c.gap > 1 ? "(são)" : ""} lacuna${c.gap > 1 ? "s" : ""}`;
    s += ".";
    if (risco) s += ` Risco de implantação: ${risco.faixa}.`;
    return s;
  })();

  // ----- Edições manuais do relatório (persistidas no diagnóstico) -----
  const edits = d?.edits || {};
  const sinteseView = edits.sintese ?? sintese;
  const obsView = edits.obs ?? "";
  const atendeView = (it) => edits.linhas?.[it?.r?.id]?.atende ?? comoAtendemos(it);
  const temEdicoes = !!(edits.sintese || edits.obs || (edits.linhas && Object.keys(edits.linhas).length));

  const entrarEdicao = () => { setDraft({ sintese: edits.sintese ?? sintese, obs: edits.obs ?? "", linhas: { ...(edits.linhas || {}) } }); setEditMode(true); };
  const cancelarEdicao = () => { setDraft(null); setEditMode(false); };
  const setLinhaDraft = (rid, val) => setDraft((dr) => ({ ...dr, linhas: { ...dr.linhas, [rid]: { ...(dr.linhas?.[rid] || {}), atende: val } } }));
  const salvarEdicoes = () => {
    const clean = {
      sintese: (draft.sintese ?? "").trim() ? draft.sintese : undefined,
      obs: (draft.obs ?? "").trim() ? draft.obs : undefined,
      linhas: draft.linhas,
    };
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => (x.id === d.id ? { ...x, edits: clean } : x)) });
    setEditMode(false); setDraft(null);
  };
  const restaurar = () => {
    if (!confirm("Descartar as edições e voltar ao texto gerado automaticamente?")) return;
    saveDiag && saveDiag({ ...diag, diagnosticos: diag.diagnosticos.map((x) => (x.id === d.id ? { ...x, edits: undefined } : x)) });
    setEditMode(false); setDraft(null);
  };

  // ----- Plano de implantação (tarefas cadastradas na funcionalidade) -----
  const tarefasDe = (f) => (f?.tarefas || []);
  const horasFunc = (f) => tarefasDe(f).reduce((s, t) => s + (Number(t.horas) || 0), 0);
  const funcsNoRelatorio = [...new Map(linhas.map((it) => [it.f?.id, it.f]).filter(([id]) => id)).values()];
  const horasTotais = funcsNoRelatorio.reduce((s, f) => s + horasFunc(f), 0);

  const copiar = () => {
    let t = `RELATÓRIO DE ADERÊNCIA\nCliente: ${d.cliente_nome}\nEscopo: ${escopoLabel(d)}\nData: ${fmtDate(d.criado_em)}\n\n`;
    t += `DADOS DA EMPRESA\n  Nome: ${d.cliente_nome}\n`;
    campos.forEach((c) => (t += `  ${c.label}: ${dadosEmpresa[c.id]}\n`));
    t += `\n`;
    t += sinteseView + "\n";
    if (horasTotais > 0) t += `Esforço de implantação estimado: ${horasTotais} h\n`;
    if (matFaixa) t += `Maturidade do negócio: ${matFaixa.l} (${maturidade}/100)\n`;
    t += `\nResumo: rever ${dados.contagem.rever} · não atende ${dados.contagem.gap} · customização ${dados.contagem.custom} · parcial ${dados.contagem.parcial} · parceira ${dados.contagem.parceira} · atende ${dados.contagem.atende} · já ok ${dados.contagem.ok}\n`;
    ["rever", "gap", "custom", "parcial", "parceira", "atende", "ok"].forEach((v) => { if (notas[v]) t += `Nota (${VEREDITOS[v].label}): ${notas[v]}\n`; });
    if (dados.outros.length) {
      t += `\n— REVER (Outro) → volta para curadoria —\n`;
      dados.outros.forEach((it) => (t += `\n• ${it.f?.nome} [Rever]\n  Hoje: ${it.p?.texto} → Outro: ${it.r.texto_outro}\n`));
    }
    t += `\n— COMO É HOJE  →  COMO PODEMOS ATENDER —\n`;
    linhas.forEach((it) => {
      const hoje = it.r?.texto_outro ? `Outro: ${it.r.texto_outro}` : it.o?.texto;
      t += `\n• ${it.f?.nome} [${VEREDITOS[it.veredito].short}]\n  Hoje: ${it.p?.texto} → ${hoje}\n  Atendemos: ${atendeView(it)}\n`;
      if (it.r?.anexos?.length) t += `  Anexos: ${it.r.anexos.map((a) => a.nome).join(", ")}\n`;
      const tks = tarefasDe(it.f);
      if (tks.length) {
        t += `  Plano de implantação (${horasFunc(it.f)} h):\n`;
        tks.forEach((tk) => (t += `    - ${tk.nome} · ${tk.horas} h · ${tk.area}\n`));
      }
    });
    if (obsView.trim()) t += `\nOBSERVAÇÕES\n${obsView}\n`;
    if (anexosIniciais.length) {
      t += `\nEVIDÊNCIAS (perguntas iniciais)\n`;
      anexosIniciais.forEach((e) => (t += `  • ${e.pergunta}: ${e.anexos.map((a) => a.nome).join(", ")}\n`));
    }
    if (oportunidades.length) {
      t += `\nOPORTUNIDADES LEVANTADAS (perguntas iniciais)${d.maturidade != null ? ` · maturidade ${d.maturidade}/100` : ""}\n`;
      oportunidades.forEach((fid) => (t += `  • ${funcNome(fid)} — ${cruzamentoLabel(vereditoPorFunc[fid])}\n`));
    }
    navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <SectionTitle sub={`${d.cliente_nome} · ${escopoLabel(d)} · ${fmtDate(d.criado_em)}`}>Pré-relatório de aderência</SectionTitle>
        <div className="flex items-center gap-2">
          {diags.length > 1 && (
            <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm max-w-xs" value={d.id} onChange={(e) => setSelectedId(e.target.value)}>
              {diags.map((x) => <option key={x.id} value={x.id}>{x.cliente_nome} · {fmtDate(x.criado_em)}</option>)}
            </select>
          )}
          {!editMode ? (
            <button className={btnGhost} onClick={entrarEdicao}><Edit3 className="w-4 h-4" /> Editar</button>
          ) : (
            <>
              <button className={btnGhost} onClick={cancelarEdicao}>Cancelar</button>
              <button className={btnTeal} onClick={salvarEdicoes}><Save className="w-4 h-4" /> Salvar</button>
            </>
          )}
          {!editMode && temEdicoes && <button className={btnGhost} onClick={restaurar}><RotateCcw className="w-4 h-4" /> Restaurar</button>}
          {!editMode && goToPlano && <button className={btnGhost} onClick={() => goToPlano(d.id)}><ListChecks className="w-4 h-4" /> Plano de projeto</button>}
          {!editMode && goToDiagnostico && <button className={btnGhost} onClick={() => goToDiagnostico(d.id)}><Pencil className="w-4 h-4" /> Corrigir respostas</button>}
          <button className={btnGhost} onClick={copiar} disabled={editMode}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copiado" : "Copiar"}</button>
        </div>
      </div>

      {temEdicoes && !editMode && (
        <div className="mb-4 rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800 flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5" /> Este relatório tem ajustes manuais. Use “Restaurar” para voltar ao texto gerado.
        </div>
      )}

      {risco && (
        <div className={`rounded-xl border p-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 ${risco.faixa === "Alto" ? "bg-red-50 border-red-300" : risco.faixa === "Médio" ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-300"}`}>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500">Risco de implantação</div>
            <div className={`text-2xl font-semibold ${risco.faixa === "Alto" ? "text-red-700" : risco.faixa === "Médio" ? "text-amber-800" : "text-emerald-700"}`}>{risco.faixa}</div>
          </div>
          <div className="text-sm text-slate-600">
            {risco.pct}% do risco máximo · {risco.partes.length ? `${risco.partes.join(" + ")} de ${risco.avaliados} itens` : "tudo coberto pelo sistema"}
          </div>
        </div>
      )}

      {matFaixa && (
        <div className={`rounded-xl border p-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 ${matFaixa.cor === "emerald" ? "bg-emerald-50 border-emerald-300" : matFaixa.cor === "amber" ? "bg-amber-50 border-amber-300" : "bg-red-50 border-red-300"}`}>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500">Maturidade do negócio</div>
            <div className={`text-2xl font-semibold ${matFaixa.cor === "emerald" ? "text-emerald-700" : matFaixa.cor === "amber" ? "text-amber-800" : "text-red-700"}`}>{matFaixa.l}</div>
          </div>
          <div className="text-sm text-slate-600">{maturidade}/100 · das perguntas iniciais</div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Dados da empresa</h3>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between text-sm border-b border-slate-100 py-1">
            <span className="text-slate-500">Nome</span><span className="text-slate-800 font-medium">{d.cliente_nome}</span>
          </div>
          {campos.map((c) => (
            <div key={c.id} className="flex justify-between text-sm border-b border-slate-100 py-1">
              <span className="text-slate-500">{c.label}</span><span className="text-slate-800 font-medium">{dadosEmpresa[c.id]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5">
        {editMode ? (
          <>
            <Label>Síntese</Label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y" style={{ minHeight: 72 }} value={draft.sintese} onChange={(e) => setDraft((dr) => ({ ...dr, sintese: e.target.value }))} />
          </>
        ) : (
          sinteseView && <p className="text-sm text-slate-600 leading-relaxed">{sinteseView}</p>
        )}
        {horasTotais > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-slate-500"><Clock className="w-3.5 h-3.5" /> Esforço de implantação estimado: {horasTotais} h</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 items-start">
        {["rever", "gap", "custom", "parcial", "parceira", "atende", "ok"].map((v) => (
          <div key={v} className={`rounded-xl border p-4 ${VEREDITOS[v].chip}`}>
            <div className="text-3xl font-semibold">{dados.contagem[v] || 0}</div>
            <div className="font-mono text-xs uppercase tracking-wider mt-1">{VEREDITOS[v].label}</div>
            {notaEdit === v ? (
              <div className="mt-2">
                <textarea autoFocus className="w-full rounded border border-slate-300 bg-white/90 px-2 py-1 text-xs text-slate-800 outline-none resize-y" style={{ minHeight: 46 }} value={notaTxt} onChange={(e) => setNotaTxt(e.target.value)} placeholder="Nota para este grupo…" />
                <div className="flex gap-2 mt-1">
                  <button className="text-[11px] font-medium rounded bg-teal-700 text-white px-2 py-0.5" onClick={() => { salvarNota(v, notaTxt); setNotaEdit(null); }}>Salvar</button>
                  <button className="text-[11px] text-slate-500 px-1" onClick={() => setNotaEdit(null)}>cancelar</button>
                </div>
              </div>
            ) : notas[v] ? (
              <div className="mt-2 text-xs text-slate-700 whitespace-pre-wrap cursor-pointer hover:opacity-80" onClick={() => { setNotaEdit(v); setNotaTxt(notas[v]); }} title="Editar nota">{notas[v]}</div>
            ) : (
              <button className="mt-2 text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-teal-700 inline-flex items-center gap-1" onClick={() => { setNotaEdit(v); setNotaTxt(""); }}>+ nota</button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {dados.outros.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-3"><VeredictoChip v="rever" size="lg" /><span className="text-sm text-slate-400">respostas em texto livre → voltam para a curadoria</span></div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 space-y-2">
              {dados.outros.map((it, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-slate-700">{it.f?.nome}:</span> <span className="text-slate-600">{it.r.texto_outro}</span>
                  <Anexos lista={it.r?.anexos} />
                </div>
              ))}
            </div>
          </div>
        )}

        {linhas.map((it, i) => (
          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
              <VeredictoChip v={it.veredito} />
              <span className="font-semibold text-slate-900">{it.f?.nome}</span>
              {horasFunc(it.f) > 0 && <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-slate-400"><Clock className="w-3 h-3" />{horasFunc(it.f)} h</span>}
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="p-4 bg-slate-50/60 sm:border-r border-slate-100">
                <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-1">Como é hoje</div>
                <div className="text-sm text-slate-500">{it.p?.texto}</div>
                <div className="text-sm text-slate-800 font-medium mt-1">{it.r?.texto_outro ? `Outro: ${it.r.texto_outro}` : it.o?.texto}</div>
                <Anexos lista={it.r?.anexos} />
              </div>
              <div className="p-4">
                <div className="font-mono text-[11px] uppercase tracking-widest text-teal-600 mb-1">Como podemos atender</div>
                {editMode ? (
                  <textarea className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y" style={{ minHeight: 60 }} value={draft.linhas?.[it.r.id]?.atende ?? comoAtendemos(it)} onChange={(e) => setLinhaDraft(it.r.id, e.target.value)} />
                ) : (
                  <div className="text-sm text-slate-700">{atendeView(it)}</div>
                )}
                {tarefasDe(it.f).length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-1.5"><Clock className="w-3 h-3" /> Plano de implantação · {horasFunc(it.f)} h</div>
                    <ul className="space-y-1">
                      {tarefasDe(it.f).map((tk) => (
                        <li key={tk.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="flex-1">{tk.nome}</span>
                          <span className="font-mono text-slate-400 whitespace-nowrap">{tk.horas} h</span>
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap">{tk.area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editMode || obsView.trim()) && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-1">Observações do consultor</div>
          {editMode ? (
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y" style={{ minHeight: 72 }} value={draft.obs} onChange={(e) => setDraft((dr) => ({ ...dr, obs: e.target.value }))} placeholder="Notas livres que entram no relatório e na cópia." />
          ) : (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{obsView}</p>
          )}
        </div>
      )}

      {anexosIniciais.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-2">Evidências · perguntas iniciais</div>
          <div className="space-y-3">
            {anexosIniciais.map((e) => (
              <div key={e.id}>
                <div className="text-sm text-slate-600">{e.pergunta}</div>
                <Anexos lista={e.anexos} />
              </div>
            ))}
          </div>
        </div>
      )}

      {oportunidades.length > 0 && (
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-teal-700">Oportunidades levantadas · perguntas iniciais</h3>
            {d.maturidade != null && <span className="text-xs text-slate-500">maturidade {d.maturidade}/100</span>}
          </div>
          <div className="space-y-1.5">
            {oportunidades.map((fid) => {
              const v = vereditoPorFunc[fid];
              return (
                <div key={fid} className="flex items-center gap-2 text-sm">
                  {v ? <VeredictoChip v={v} /> : <span className="font-mono text-[11px] bg-slate-100 text-slate-400 rounded px-1.5 py-0.5">—</span>}
                  <span className="text-slate-800 font-medium">{funcNome(fid)}</span>
                  <span className="text-slate-500">· {cruzamentoLabel(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
