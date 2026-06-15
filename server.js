import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { Contacts, Messages, Settings, Channels, contactCount } from "./src/store.js";
import { sendEmail, emailConfigured, fill, resetTransporter, emailThrottleMs } from "./src/email.js";
import { sendWhatsapp, whatsappConfigured, waLink } from "./src/whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Confia no proxy do Railway só pra `req.ip` refletir o IP real (X-Forwarded-For).
app.set("trust proxy", 1);

// Cabeçalhos de segurança mínimos (sem dependência de helmet).
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  // CSP enxuta: tudo do mesmo origin, sem inline scripts externos.
  // O HTML usa <script> inline e estilos inline, então liberamos 'unsafe-inline'
  // apenas para script e style. Sem objects, sem frames, sem mixed content.
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
  );
  next();
});

app.use(express.json({ limit: "100kb" }));

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:" + (process.env.PORT || 3000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Rate limit in-memory para falhas de autenticação ──
// 10 falhas em 15 min → bloqueia o IP por 15 min. Janela rolante, sem deps.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILS = 10;
const authFails = new Map(); // ip -> { count, firstAt }

function recordAuthFail(ip) {
  const now = Date.now();
  const rec = authFails.get(ip);
  if (!rec || now - rec.firstAt > AUTH_WINDOW_MS) {
    authFails.set(ip, { count: 1, firstAt: now });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}
function isAuthLocked(ip) {
  const rec = authFails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > AUTH_WINDOW_MS) { authFails.delete(ip); return false; }
  return rec.count >= AUTH_MAX_FAILS;
}
function clearAuthFails(ip) { authFails.delete(ip); }
setInterval(() => {
  const cutoff = Date.now() - AUTH_WINDOW_MS;
  for (const [ip, rec] of authFails) if (rec.firstAt < cutoff) authFails.delete(ip);
}, AUTH_WINDOW_MS).unref();

function safeEq(a, b) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

// ── Basic Auth para o painel e a API (não protege /u/ de descadastro) ──
function auth(req, res, next) {
  const user = process.env.ADMIN_USER, pass = process.env.ADMIN_PASS;
  if (!user || !pass) return next(); // sem credenciais definidas = aberto (defina no Railway!)

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (isAuthLocked(ip)) {
    return res.status(429).set("Retry-After", String(AUTH_WINDOW_MS / 1000)).send("Muitas tentativas. Tente de novo em alguns minutos.");
  }

  const hdr = req.headers.authorization || "";
  const [scheme, b64] = hdr.split(" ");
  let decoded = "";
  if (scheme === "Basic" && b64) {
    try { decoded = Buffer.from(b64, "base64").toString("utf8"); } catch { decoded = ""; }
  }
  const idx = decoded.indexOf(":");
  const u = idx >= 0 ? decoded.slice(0, idx) : "";
  const p = idx >= 0 ? decoded.slice(idx + 1) : "";

  if (safeEq(u, user) && safeEq(p, pass)) {
    clearAuthFails(ip);
    return next();
  }
  const fails = recordAuthFail(ip);
  if (fails >= AUTH_MAX_FAILS) {
    return res.status(429).set("Retry-After", String(AUTH_WINDOW_MS / 1000)).send("Muitas tentativas. Tente de novo em alguns minutos.");
  }
  res.set("WWW-Authenticate", 'Basic realm="Adelina"').status(401).send("Autenticação necessária.");
}

// ── Descadastro (público, sem auth) ──
app.get("/u/:token", (req, res) => {
  const c = Contacts.byToken(req.params.token);
  if (c) Contacts.update(c.id, { opted_out: 1, status: "sem" });
  res.set("Content-Type", "text/html").send(`<!doctype html><meta charset="utf-8">
    <body style="font-family:Arial;background:#09090b;color:#ededf0;padding:48px;text-align:center">
    <h2>Pronto.</h2><p>${c ? "Você não receberá mais nossos contatos." : "Link inválido."}</p></body>`);
});

app.get("/api/health", (req, res) => res.json({ ok: true, contacts: contactCount() }));

// ── Tudo abaixo exige auth ──
app.use("/api", auth);

app.get("/api/status", (req, res) => {
  res.json({
    contacts: contactCount(),
    cities: Contacts.cities(),
    email: emailConfigured(),
    whatsapp: whatsappConfigured(),
    publicUrl: PUBLIC_URL,
  });
});

app.get("/api/contacts", (req, res) => {
  res.json(Contacts.all({ city: req.query.city, status: req.query.status }));
});

app.post("/api/contacts", (req, res) => res.json(Contacts.add(req.body || {})));

app.patch("/api/contacts/:id", (req, res) => {
  const c = Contacts.get(req.params.id);
  if (!c) return res.status(404).json({ error: "não encontrado" });
  res.json(Contacts.update(req.params.id, req.body || {}));
});

app.get("/api/settings", (req, res) => res.json(Settings.all()));
app.put("/api/settings", (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) Settings.set(k, v);
  res.json(Settings.all());
});

app.get("/api/config", (req, res) => res.json(Channels.all()));
app.put("/api/config", (req, res) => {
  const saved = Channels.set(req.body || {});
  resetTransporter();
  res.json({ ok: true, config: saved, email: emailConfigured(), whatsapp: whatsappConfigured() });
});

app.get("/api/whatsapp/link/:id", (req, res) => {
  const c = Contacts.get(req.params.id);
  if (!c) return res.status(404).json({ error: "não encontrado" });
  res.json({ url: waLink({ contact: c, bodyTpl: Settings.get("whatsapp_body"), senderName: Settings.get("sender_name") }) });
});

// ── Envio de e-mail em lote (sequencial, com throttle) ──
app.post("/api/send-email", async (req, res) => {
  if (!emailConfigured()) return res.status(400).json({ error: "SMTP não configurado." });
  const ids = (req.body?.contactIds || []).slice(0, 200);
  const throttle = emailThrottleMs();
  const sender = Settings.get("sender_name");
  const subjectTpl = Settings.get("email_subject");
  const bodyTpl = Settings.get("email_body");
  const results = [];

  for (const id of ids) {
    const c = Contacts.get(id);
    if (!c) { results.push({ id, ok: false, error: "não encontrado" }); continue; }
    try {
      const { subject } = await sendEmail({ contact: c, subjectTpl, bodyTpl, senderName: sender, publicUrl: PUBLIC_URL });
      Messages.log({ contact_id: id, channel: "email", to_addr: c.email, subject, status: "enviado" });
      if (c.status === "novo") Contacts.update(id, { status: "enviado" });
      results.push({ id, ok: true });
    } catch (e) {
      Messages.log({ contact_id: id, channel: "email", to_addr: c.email, status: "erro", error: e.message });
      results.push({ id, ok: false, error: e.message });
    }
    if (ids.length > 1) await sleep(throttle);
  }
  res.json({ results });
});

// ── Envio WhatsApp Cloud API em lote ──
app.post("/api/send-whatsapp", async (req, res) => {
  if (!whatsappConfigured()) return res.status(400).json({ error: "Cloud API não configurada. Use os links wa.me." });
  const ids = (req.body?.contactIds || []).slice(0, 200);
  const results = [];
  for (const id of ids) {
    const c = Contacts.get(id);
    if (!c) { results.push({ id, ok: false, error: "não encontrado" }); continue; }
    try {
      const r = await sendWhatsapp({ contact: c });
      Messages.log({ contact_id: id, channel: "whatsapp", to_addr: c.wa, status: "enviado" });
      if (c.status === "novo") Contacts.update(id, { status: "enviado" });
      results.push({ id, ok: true, messageId: r.id });
    } catch (e) {
      Messages.log({ contact_id: id, channel: "whatsapp", to_addr: c.wa, status: "erro", error: e.message });
      results.push({ id, ok: false, error: e.message });
    }
    await sleep(1500);
  }
  res.json({ results });
});

app.get("/api/log", (req, res) => res.json(Messages.recent(120)));

// ── UI ──
app.use("/", auth, express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
if (contactCount() === 0) {
  await import("./src/seed.js");
}
app.listen(PORT, () => console.log(`Adelina · Prospecção rodando em ${PUBLIC_URL} (porta ${PORT})`));
