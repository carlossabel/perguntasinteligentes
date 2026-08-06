import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { load, save, DATA_FILE } from "./db.js";
import { seedBase } from "./seed.js";
import { gerarComIA, gerarAssessmentComIA } from "./anthropic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "5mb" }));

// Garante que sempre exista uma base (semeia na primeira execução)
function getData() {
  const d = load();
  if (!d.base) {
    d.base = seedBase();
    save(d);
  }
  if (!d.diag) d.diag = { diagnosticos: [], respostas: [] };
  let mudou = migrarSegmentos(d.base);
  // Modelo novo: funcionalidade transversal (segmento_ids) e área global.
  (d.base.funcionalidades || []).forEach((f) => {
    if (!Array.isArray(f.segmento_ids)) {
      const area = (d.base.areas || []).find((a) => a.id === f.area_id);
      f.segmento_ids = area && area.segmento_id ? [area.segmento_id] : [];
      mudou = true;
    }
  });
  // Assessment de segmento (estágio 1) — garante as coleções.
  if (!Array.isArray(d.base.assessmentPerguntas)) { d.base.assessmentPerguntas = []; mudou = true; }
  if (!Array.isArray(d.base.assessmentOpcoes)) { d.base.assessmentOpcoes = []; mudou = true; }
  if (!Array.isArray(d.diag.assessments)) { d.diag.assessments = []; mudou = true; }
  if (!Array.isArray(d.diag.assessmentRespostas)) { d.diag.assessmentRespostas = []; mudou = true; }
  // Ficha da empresa: campos definidos pelo usuário. Semeia 3 exemplos na 1a vez.
  if (!Array.isArray(d.base.camposEmpresa)) {
    d.base.camposEmpresa = [
      { id: "cnpj", label: "CNPJ", tipo: "texto", opcoes: [], obrigatorio: false, ordem: 0 },
      { id: "filiais", label: "Número de filiais", tipo: "numero", opcoes: [], obrigatorio: false, ordem: 1 },
      { id: "regime", label: "Regime tributário", tipo: "selecao", opcoes: ["Simples Nacional", "Lucro Presumido", "Lucro Real"], obrigatorio: false, ordem: 2 },
    ];
    mudou = true;
  }
  if (typeof d.base.iaPosturaAssessment !== "string") {
    d.base.iaPosturaAssessment = "Aja como um consultor sênior de negócios especializado em indústria. Seu objetivo é entender, de forma macro, como a empresa opera: sua dinâmica, nível de organização, processos e gargalos. Faça perguntas de alto nível que um diretor ou gerente responderia — não perguntas técnicas de sistema. Busque revelar a maturidade do negócio e onde há oportunidade de evolução.";
    mudou = true;
  }
  if (mudou) save(d);
  return d;
}

// Migração: bases antigas não têm 'segmentos'. Cria um segmento padrão e
// pendura todas as áreas nele, para o modelo segmento→área→funcionalidade valer.
function migrarSegmentos(base) {
  if (!base) return false;
  let mudou = false;
  if (!Array.isArray(base.segmentos)) { base.segmentos = []; mudou = true; }
  const areasSemSeg = (base.areas || []).filter((a) => !a.segmento_id);
  if (base.segmentos.length === 0 || areasSemSeg.length > 0) {
    let padrao = base.segmentos[0];
    if (!padrao) {
      padrao = { id: "seg_" + Date.now().toString(36), nome: "Geral" };
      base.segmentos.push(padrao);
      mudou = true;
    }
    areasSemSeg.forEach((a) => { a.segmento_id = padrao.id; mudou = true; });
  }
  return mudou;
}

// ---- Base de conhecimento (áreas, funcionalidades, perguntas, opções) ----
app.get("/api/base", (_req, res) => res.json(getData().base));
app.put("/api/base", (req, res) => {
  const d = getData();
  d.base = req.body;
  save(d);
  res.json({ ok: true });
});

// ---- Diagnósticos e respostas ----
app.get("/api/diag", (_req, res) => res.json(getData().diag));
app.put("/api/diag", (req, res) => {
  const d = getData();
  d.diag = req.body;
  save(d);
  res.json({ ok: true });
});

// ---- Geração pela IA (chave fica só aqui, no servidor) ----
app.post("/api/generate", async (req, res) => {
  const { tema, areaId } = req.body || {};
  if (!tema) return res.status(400).json({ error: "Informe um tema." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no .env do servidor." });
  }

  const d = getData();
  const recusadas = (d.base.perguntas || [])
    .filter((p) => {
      const f = (d.base.funcionalidades || []).find((x) => x.id === p.funcionalidade_id);
      return p.status === "recusada" && (!areaId || (f && f.area_id === areaId));
    })
    .map((p) => ({ texto: p.texto, motivo: p.motivo }));

  try {
    const out = await gerarComIA({
      tema,
      recusadas,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      apiKey,
    });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/generate-assessment", async (req, res) => {
  const { segmentoId } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no .env do servidor." });

  const d = getData();
  const seg = (d.base.segmentos || []).find((s) => s.id === segmentoId);
  if (!seg) return res.status(400).json({ error: "Segmento não encontrado." });

  const funcs = (d.base.funcionalidades || [])
    .filter((f) => Array.isArray(f.segmento_ids) && f.segmento_ids.includes(segmentoId))
    .map((f) => ({ id: f.id, nome: f.nome }));

  try {
    const out = await gerarAssessmentComIA({
      segmento: seg.nome,
      funcs,
      postura: d.base.iaPosturaAssessment || "",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      apiKey,
    });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Diagnóstico de Aderência ouvindo na porta ${PORT}`);
  console.log(`  Dados persistidos em: ${DATA_FILE}\n`);
});
