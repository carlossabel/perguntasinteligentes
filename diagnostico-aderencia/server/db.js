import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "data.json");

/**
 * Persistência mínima em arquivo JSON.
 * Estrutura: { base: {areas, funcionalidades, perguntas, opcoes}, diag: {diagnosticos, respostas} }
 * Para produção com múltiplos usuários simultâneos, troque por SQLite/Postgres —
 * a interface (load/save) é a mesma.
 */
export function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { base: null, diag: { diagnosticos: [], respostas: [] } };
  }
}

export function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}
