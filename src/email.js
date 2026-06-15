import nodemailer from "nodemailer";
import { Channels } from "./store.js";

let transporter = null;
let transporterKey = "";

function cfg(dbKey, envKey, def = "") {
  const v = Channels.get(dbKey);
  if (v) return v;
  if (envKey && process.env[envKey]) return process.env[envKey];
  return def;
}

function smtpConf() {
  return {
    host: cfg("smtp_host", "SMTP_HOST"),
    port: Number(cfg("smtp_port", "SMTP_PORT", "465")),
    secure: String(cfg("smtp_secure", "SMTP_SECURE", "true")) === "true",
    user: cfg("smtp_user", "SMTP_USER"),
    pass: cfg("smtp_pass", "SMTP_PASS"),
    fromName: cfg("mail_from_name", "MAIL_FROM_NAME", "Adelina"),
    fromEmail: cfg("mail_from_email", "MAIL_FROM_EMAIL"),
    replyTo: cfg("mail_reply_to", "MAIL_REPLY_TO"),
  };
}

export function emailConfigured() {
  const c = smtpConf();
  return Boolean(c.host && c.user && c.pass && c.fromEmail);
}

export function resetTransporter() {
  transporter = null;
  transporterKey = "";
}

function getTransporter() {
  const c = smtpConf();
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
    });
    transporterKey = key;
  }
  return transporter;
}

export function fill(tpl, contact, senderName) {
  return (tpl || "")
    .replaceAll("{nome}", contact.nome || "")
    .replaceAll("{cidade}", contact.cidade || "")
    .replaceAll("{seuNome}", (senderName || "").trim() || "a equipe Adelina");
}

function htmlFromText(text, unsubUrl) {
  const body = text
    .split("\n")
    .map((l) => (l.trim() === "" ? "<br/>" : `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`))
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#999;margin:0">
      Você recebeu este e-mail como contato comercial.
      <a href="${unsubUrl}" style="color:#999">Não quero mais receber</a>.
    </p>
  </div>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function sendEmail({ contact, subjectTpl, bodyTpl, senderName, publicUrl }) {
  if (!emailConfigured()) throw new Error("SMTP não configurado (preencha em ⚙️ Canais).");
  if (!contact.email) throw new Error("Contato sem e-mail.");
  if (contact.opted_out) throw new Error("Contato descadastrado.");

  const c = smtpConf();
  const subject = fill(subjectTpl, contact, senderName);
  const text = fill(bodyTpl, contact, senderName);
  const unsubUrl = `${publicUrl.replace(/\/$/, "")}/u/${contact.unsub_token}`;

  await getTransporter().sendMail({
    from: `"${c.fromName}" <${c.fromEmail}>`,
    to: contact.email,
    replyTo: c.replyTo || undefined,
    subject,
    text: `${text}\n\n---\nPara não receber mais: ${unsubUrl}`,
    html: htmlFromText(text, unsubUrl),
    headers: { "List-Unsubscribe": `<${unsubUrl}>` },
  });

  return { subject };
}

export function emailThrottleMs() {
  const v = Number(cfg("email_throttle_seconds", "EMAIL_THROTTLE_SECONDS", "8"));
  return (Number.isFinite(v) ? v : 8) * 1000;
}
