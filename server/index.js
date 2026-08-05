import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { load, save } from "./db.js";
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
  return d;
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
app.listen(PORT, "0.0.0.0", () =>
  console.log(`\n  Diagnóstico de Aderência ouvindo na porta ${PORT}\n`)
);
