const JSON_HEADERS = { "Content-Type": "application/json" };

export async function getBase() {
  const r = await fetch("/api/base");
  if (!r.ok) throw new Error("Falha ao carregar a base.");
  return r.json();
}

export async function putBase(base) {
  const r = await fetch("/api/base", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(base) });
  if (!r.ok) throw new Error("Falha ao salvar a base.");
  return r.json();
}

export async function getDiag() {
  const r = await fetch("/api/diag");
  if (!r.ok) throw new Error("Falha ao carregar diagnósticos.");
  return r.json();
}

export async function putDiag(diag) {
  const r = await fetch("/api/diag", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(diag) });
  if (!r.ok) throw new Error("Falha ao salvar diagnósticos.");
  return r.json();
}

export async function generate(tema, areaId) {
  const r = await fetch("/api/generate", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ tema, areaId }) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}
