import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { load, save, DATA_FILE, UPLOAD_DIR } from "./db.js";
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
  // Entidade Empresa (Fatia 1): pivô que acumula ao longo das fases.
  if (!Array.isArray(d.diag.empresas)) { d.diag.empresas = []; mudou = true; }
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  (d.diag.assessments || []).forEach((a) => {
    if (a.empresa_id) return;
    const key = (a.cliente_nome || "").trim().toLowerCase();
    let emp = d.diag.empresas.find((e) => (e.nome || "").trim().toLowerCase() === key);
    if (!emp) {
      emp = { id: genId(), nome: a.cliente_nome || "Empresa", dados: { ...(a.dados || {}) }, criado_em: a.criado_em || new Date().toISOString() };
      d.diag.empresas.push(emp);
    } else {
      Object.entries(a.dados || {}).forEach(([k, v]) => { if (v && !emp.dados[k]) emp.dados[k] = v; });
    }
    a.empresa_id = emp.id;
    mudou = true;
  });
  // Ficha da empresa: campos definidos pelo usuário. Semeia 3 exemplos na 1a vez.
  if (!Array.isArray(d.base.camposEmpresa)) {
    d.base.camposEmpresa = [
      { id: "cnpj", label: "CNPJ", tipo: "texto", opcoes: [], obrigatorio: false, ordem: 0 },
      { id: "filiais", label: "Número de filiais", tipo: "numero", opcoes: [], obrigatorio: false, ordem: 1 },
      { id: "regime", label: "Regime tributário", tipo: "selecao", opcoes: ["Simples Nacional", "Lucro Presumido", "Lucro Real"], obrigatorio: false, ordem: 2 },
    ];
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

// ---- Anexos (documentos, fotos, áudios das respostas) ----
const MIME_EXT = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic",
  "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/wav": ".wav",
  "application/pdf": ".pdf",
};
const mimeExt = (tipo) => MIME_EXT[tipo] || "";

app.post("/api/upload", express.raw({ type: "*/*", limit: "60mb" }), (req, res) => {
  try {
    const nome = (req.query.nome || "arquivo").toString().slice(0, 200);
    const tipo = (req.query.tipo || "application/octet-stream").toString();
    const buf = req.body;
    if (!buf || !buf.length) return res.status(400).json({ error: "Arquivo vazio." });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    let ext = path.extname(nome);
    if (!ext) ext = mimeExt(tipo);
    const fname = id + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
    res.json({ id, nome, tipo, url: "/uploads/" + fname, tamanho: buf.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/upload/delete", (req, res) => {
  const url = (req.body && req.body.url) || "";
  const fname = path.basename(url);
  if (fname && !fname.includes("..")) { try { fs.unlinkSync(path.join(UPLOAD_DIR, fname)); } catch { /* já removido */ } }
  res.json({ ok: true });
});

app.use("/uploads", express.static(UPLOAD_DIR));

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
