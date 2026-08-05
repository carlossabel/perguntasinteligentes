import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { load, save, DATA_FILE } from "./db.js";
import { seedBase } from "./seed.js";
import { gerarComIA } from "./anthropic.js";

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
  if (migrarSegmentos(d.base)) save(d);
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

// ---- Serve o front-end buildado (produção) ----
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
