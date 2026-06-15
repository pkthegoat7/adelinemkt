import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import crypto from "node:crypto";

const DB_PATH = process.env.DB_PATH || "./data/adelina.json";
try { mkdirSync(dirname(DB_PATH), { recursive: true }); } catch {}

let DB = { contacts: {}, messages: [], settings: {}, channels: {}, seq: 0 };
if (existsSync(DB_PATH)) {
  try { DB = JSON.parse(readFileSync(DB_PATH, "utf8")); } catch { /* arquivo vazio/corrompido */ }
  DB.contacts = DB.contacts || {};
  DB.messages = DB.messages || [];
  DB.settings = DB.settings || {};
  DB.channels = DB.channels || {};
  DB.seq = DB.seq || 0;
}

let writeTimer = null;
function persist() {
  // gravação assíncrona com debounce; também grava na saída do processo
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 200);
}
function flush() {
  try { writeFileSync(DB_PATH, JSON.stringify(DB)); } catch (e) { console.error("Falha ao gravar DB:", e.message); }
}
process.on("exit", flush);
process.on("SIGTERM", () => { flush(); process.exit(0); });
process.on("SIGINT", () => { flush(); process.exit(0); });

export function token() { return crypto.randomBytes(16).toString("hex"); }

export function seedContacts(rows) {
  for (const r of rows) {
    const prev = DB.contacts[r.id] || {};
    DB.contacts[r.id] = {
      id: r.id, nome: r.nome, cidade: r.cidade, fone: r.fone || null, wa: r.wa || null,
      mobile: r.mobile ? 1 : 0, site: r.site || "", rating: r.rating ?? null, avals: r.avals ?? null,
      // preserva dados editados pelo usuário em re-seeds
      email: prev.email ?? (r.email || null),
      status: prev.status ?? "novo",
      opted_out: prev.opted_out ?? 0,
      unsub_token: prev.unsub_token ?? token(),
      notes: prev.notes ?? "",
      updated_at: new Date().toISOString(),
    };
  }
  flush();
}

const byCityRating = (a, b) =>
  a.cidade === b.cidade ? (b.rating || 0) - (a.rating || 0) : a.cidade.localeCompare(b.cidade);

export const Contacts = {
  all({ city, status } = {}) {
    let list = Object.values(DB.contacts);
    if (city && city !== "Todas") list = list.filter((c) => c.cidade === city);
    if (status && status !== "Todos") list = list.filter((c) => c.status === status);
    return list.sort(byCityRating);
  },
  get(id) { return DB.contacts[id] || null; },
  byToken(t) { return Object.values(DB.contacts).find((c) => c.unsub_token === t) || null; },
  cities() {
    const m = {};
    for (const c of Object.values(DB.contacts)) m[c.cidade] = (m[c.cidade] || 0) + 1;
    return Object.entries(m).map(([cidade, n]) => ({ cidade, n })).sort((a, b) => a.cidade.localeCompare(b.cidade));
  },
  update(id, fields) {
    const c = DB.contacts[id];
    if (!c) return null;
    for (const k of ["email", "status", "notes", "opted_out"]) if (k in fields) c[k] = fields[k];
    c.updated_at = new Date().toISOString();
    persist();
    return c;
  },
  add(c) {
    const id = c.id || token();
    DB.contacts[id] = {
      id, nome: c.nome, cidade: c.cidade, fone: c.fone || null, wa: c.wa || null,
      mobile: c.mobile ? 1 : 0, site: c.site || "", rating: c.rating ?? null, avals: c.avals ?? null,
      email: c.email || null, status: "novo", opted_out: 0, unsub_token: token(),
      notes: "", updated_at: new Date().toISOString(),
    };
    persist();
    return DB.contacts[id];
  },
};

export const Messages = {
  log({ contact_id, channel, to_addr, subject, status, error }) {
    DB.messages.push({
      id: ++DB.seq, contact_id, channel, to_addr: to_addr || "", subject: subject || "",
      status, error: error || "", nome: DB.contacts[contact_id]?.nome || "", created_at: new Date().toISOString(),
    });
    if (DB.messages.length > 2000) DB.messages = DB.messages.slice(-2000);
    persist();
  },
  recent(limit = 120) { return DB.messages.slice(-limit).reverse(); },
};

const DEFAULTS = {
  sender_name: "",
  email_subject: "Integração de reservas para a {nome}",
  email_body: `Olá, tudo bem?

Aqui é {seuNome}, da Adelina. Vi a {nome} aí em {cidade} e queria apresentar rapidamente uma ferramenta feita sob medida para pousadas.

A Adelina reúne Airbnb, Booking e suas reservas diretas em uma única agenda, com sincronização a cada 5 minutos nos dois sentidos — acabando com o risco de overbooking. Tudo em uma timeline simples para a recepção usar no dia a dia.

Posso enviar um acesso de demonstração, sem compromisso? Levo cerca de 5 minutos para mostrar como funciona.

Um abraço,
{seuNome}`,
  whatsapp_body: `Olá, tudo bem? Aqui é {seuNome}, da Adelina 🌿

Vi a {nome} aí em {cidade} e queria te apresentar uma ferramenta feita sob medida pra pousadas.

A Adelina junta Airbnb, Booking e suas reservas diretas numa única agenda, sincronizando a cada 5 minutos nos dois sentidos — então acaba o risco de overbooking.

Posso te enviar um acesso de demonstração, sem compromisso?`,
};

export const Settings = {
  get(key) { return DB.settings[key] ?? DEFAULTS[key] ?? ""; },
  all() { return { ...DEFAULTS, ...DB.settings }; },
  set(key, value) { DB.settings[key] = String(value); persist(); },
};

const CHANNEL_KEYS = [
  "smtp_host","smtp_port","smtp_secure","smtp_user","smtp_pass",
  "mail_from_name","mail_from_email","mail_reply_to","email_throttle_seconds",
  "wa_enabled","wa_token","wa_phone_number_id","wa_template_name","wa_template_lang",
];

export const Channels = {
  get(key) { return DB.channels[key] ?? ""; },
  all() {
    const out = {};
    for (const k of CHANNEL_KEYS) out[k] = DB.channels[k] ?? "";
    return out;
  },
  set(patch) {
    for (const k of CHANNEL_KEYS) {
      if (k in (patch || {})) DB.channels[k] = String(patch[k] ?? "");
    }
    persist();
    return this.all();
  },
};

export function contactCount() { return Object.keys(DB.contacts).length; }

export default DB;
