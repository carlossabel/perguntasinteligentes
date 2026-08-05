import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Persistência mínima em arquivo JSON.
 * Estrutura: { base: {areas, funcionalidades, perguntas, opcoes}, diag: {diagnosticos, respostas} }
 *
 * Onde grava:
 *  - Em produção no Railway, se houver um Volume anexado, o Railway define
 *    automaticamente RAILWAY_VOLUME_MOUNT_PATH com o caminho de montagem.
 *    Gravamos o data.json ali → sobrevive a deploys.
 *  - Sem volume (ex.: dev local), cai de volta para a pasta do servidor.
 *
 * Para múltiplos usuários simultâneos, troque por SQLite/Postgres —
 * a interface (load/save) continua a mesma.
 */
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const FILE = path.join(DATA_DIR, "data.json");

// Garante que o diretório exista (o mount já existe, mas isto protege o dev local).
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {
  /* diretório já existe ou é o __dirname */
}

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

// Exportado só para diagnóstico/log — ajuda a confirmar onde está gravando.
export const DATA_FILE = FILE;
