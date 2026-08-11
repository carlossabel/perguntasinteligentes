// Reproduz a ordem do Plano de projeto (área → funcionalidade → tarefa, com as ordens salvas)
// e devolve a sequência achatada de taskIds. Usado para saber qual é "a tarefa anterior".
const ORDEM_TECNICA = ["gap", "custom", "parcial", "parceira", "atende", "ok"];
const idxVer = (v) => { const i = ORDEM_TECNICA.indexOf(v); return i === -1 ? 99 : i; };
const AVULSAS = "__avulsas__";

// Trava efetiva de uma tarefa: override do diagnóstico (planoBloqueio) se existir, senão o padrão
// definido no Cadastro (t.trava) — vale para tarefas de funcionalidade e avulsas do projeto.
export function travaBase(base, d, taskId) {
  for (const f of base.funcionalidades) {
    const t = (f.tarefas || []).find((x) => x.id === taskId);
    if (t) return !!t.trava;
  }
  const e = ((d && d.tarefasExtra) || []).find((x) => x.id === taskId);
  return e ? !!e.trava : false;
}
export function travaEfetiva(base, d, taskId) {
  const ov = ((d && d.planoBloqueio) || {})[taskId];
  return ov === undefined ? travaBase(base, d, taskId) : !!ov;
}

export function sequenciaTarefas(base, diag, d) {
  if (!d) return [];
  const rs = diag.respostas.filter((r) => r.diagnostico_id === d.id && r.tipo !== "inicial");
  const funcMap = new Map(); // funcId -> { veredito (mais crítico) }
  rs.forEach((r) => {
    const o = base.opcoes.find((x) => x.id === r.opcao_id);
    const p = base.perguntas.find((x) => x.id === r.pergunta_id);
    const fid = r.funcionalidade_id || p?.funcionalidade_id;
    const f = base.funcionalidades.find((x) => x.id === fid);
    if (!f) return;
    const v = r.veredito || o?.veredito || "rever";
    const cur = funcMap.get(f.id);
    if (!cur || idxVer(v) < idxVer(cur.veredito)) funcMap.set(f.id, { veredito: v });
  });

  // Itens (base + extras do projeto)
  const items = [];
  funcMap.forEach(({ veredito }, fid) => {
    const f = base.funcionalidades.find((x) => x.id === fid);
    (f?.tarefas || []).forEach((t) => items.push({ taskId: t.id, funcId: fid, areaId: f.area_id, veredito }));
  });
  (d.tarefasExtra || []).forEach((t) => {
    if (t.funcId) {
      const f = base.funcionalidades.find((x) => x.id === t.funcId);
      items.push({ taskId: t.id, funcId: t.funcId, areaId: f?.area_id || AVULSAS, veredito: funcMap.get(t.funcId)?.veredito ?? null });
    } else {
      items.push({ taskId: t.id, funcId: null, areaId: AVULSAS, veredito: null, avulsa: true });
    }
  });

  const funcOrder = d.planoFuncOrder || {};
  const taskOrder = d.planoTaskOrder || {};
  const areaOrder = d.planoAreaOrder || [];

  // Agrupa por funcionalidade e ordena tarefas
  const funcGroups = new Map();
  items.forEach((it) => {
    const fk = it.funcId || AVULSAS;
    if (!funcGroups.has(fk)) funcGroups.set(fk, { funcKey: fk, areaKey: it.areaId || AVULSAS, veredito: it.veredito, avulsa: !!it.avulsa, tasks: [] });
    funcGroups.get(fk).tasks.push(it.taskId);
  });
  for (const g of funcGroups.values()) {
    const saved = (taskOrder[g.funcKey] || []).filter((id) => g.tasks.includes(id));
    const rest = g.tasks.filter((id) => !saved.includes(id));
    g.tasks = [...saved, ...rest];
  }

  // Agrupa por área e ordena funcionalidades
  const areaMap = new Map();
  for (const g of funcGroups.values()) {
    if (!areaMap.has(g.areaKey)) areaMap.set(g.areaKey, { areaKey: g.areaKey, avulsa: g.areaKey === AVULSAS, funcs: [] });
    areaMap.get(g.areaKey).funcs.push(g);
  }
  for (const a of areaMap.values()) {
    const saved = (funcOrder[a.areaKey] || []).filter((fk) => a.funcs.some((g) => g.funcKey === fk));
    const rest = a.funcs.filter((g) => !saved.includes(g.funcKey)).sort((x, y) => idxVer(x.veredito) - idxVer(y.veredito)).map((g) => g.funcKey);
    const byId = new Map(a.funcs.map((g) => [g.funcKey, g]));
    a.funcs = [...saved, ...rest].map((fk) => byId.get(fk));
  }

  // Ordena áreas
  const areaCrit = (a) => a.avulsa ? 999 : Math.min(...a.funcs.map((g) => idxVer(g.veredito)));
  const lista = [...areaMap.values()];
  const salvasA = (areaOrder || []).filter((ak) => lista.some((a) => a.areaKey === ak));
  const restA = lista.filter((a) => !salvasA.includes(a.areaKey)).sort((a, b) => areaCrit(a) - areaCrit(b)).map((a) => a.areaKey);
  const byA = new Map(lista.map((a) => [a.areaKey, a]));
  const areasOrdenadas = [...salvasA, ...restA].map((ak) => byA.get(ak));

  // Achata
  const seq = [];
  areasOrdenadas.forEach((a) => a.funcs.forEach((g) => g.tasks.forEach((tid) => seq.push(tid))));
  return seq;
}
