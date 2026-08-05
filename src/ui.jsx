/* ---------- Vocabulário de veredito (enum fixo) ---------- */
export const VEREDITOS = {
  ok:     { label: "Já faz bem",       short: "OK",     desc: "sem dor; fora da proposta", chip: "bg-slate-100 text-slate-600 border-slate-300",       dot: "bg-slate-400" },
  atende:   { label: "Atende (padrão)",     short: "Atende",   desc: "resolve de fábrica",        chip: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
  parceira: { label: "Atende com parceira", short: "Parceira", desc: "resolve via parceiro",      chip: "bg-sky-100 text-sky-700 border-sky-300",             dot: "bg-sky-500" },
  parcial:  { label: "Atende parcialmente", short: "Parcial",  desc: "resolve em parte",          chip: "bg-orange-100 text-orange-700 border-orange-300",     dot: "bg-orange-500" },
  custom:   { label: "Via customização",    short: "Custom",   desc: "resolve com projeto/custo", chip: "bg-amber-100 text-amber-800 border-amber-300",       dot: "bg-amber-500" },
  gap:      { label: "Não atende",          short: "Gap",      desc: "vira roadmap",              chip: "bg-red-100 text-red-700 border-red-300",             dot: "bg-red-500" },
  rever:  { label: "Rever (Outro)",    short: "Rever",  desc: "texto livre → curadoria",    chip: "bg-teal-100 text-teal-700 border-teal-300",          dot: "bg-teal-500" },
};
export const VEREDITO_ORDER = ["gap", "parcial", "custom", "parceira", "atende", "ok"];

/* ---------- Helpers ---------- */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const slug = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const nowISO = () => new Date().toISOString();
export const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
};

/* ---------- Classes reutilizáveis ---------- */
export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition";
export const btnTeal = "inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition";
export const btnGhost = "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition";

/* ---------- Primitivos ---------- */
export function VeredictoChip({ v, size = "sm" }) {
  const cfg = VEREDITOS[v] || VEREDITOS.rever;
  const pad = size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider ${pad} ${cfg.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.short}
    </span>
  );
}

export function Label({ children }) {
  return <div className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-1">{children}</div>;
}

export function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold uppercase tracking-wide text-teal-900">{children}</h2>
      {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export function Field({ l, children }) {
  return (<div><Label>{l}</Label><p className="text-slate-700 leading-relaxed">{children}</p></div>);
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-700 font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}
