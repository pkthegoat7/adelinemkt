import { fill } from "./email.js";
import { Channels } from "./store.js";

function cfg(dbKey, envKey, def = "") {
  const v = Channels.get(dbKey);
  if (v) return v;
  if (envKey && process.env[envKey]) return process.env[envKey];
  return def;
}

function waConf() {
  return {
    enabled: String(cfg("wa_enabled", "WHATSAPP_ENABLED", "false")) === "true",
    token: cfg("wa_token", "WHATSAPP_TOKEN"),
    phoneId: cfg("wa_phone_number_id", "WHATSAPP_PHONE_NUMBER_ID"),
    templateName: cfg("wa_template_name", "WHATSAPP_TEMPLATE_NAME"),
    lang: cfg("wa_template_lang", "WHATSAPP_TEMPLATE_LANG", "pt_BR"),
  };
}

export function whatsappConfigured() {
  const c = waConf();
  return c.enabled && Boolean(c.token && c.phoneId);
}

export function waLink({ contact, bodyTpl, senderName }) {
  const msg = fill(bodyTpl, contact, senderName);
  return `https://wa.me/${contact.wa}?text=${encodeURIComponent(msg)}`;
}

export async function sendWhatsapp({ contact }) {
  if (!whatsappConfigured()) throw new Error("Cloud API não configurada.");
  if (!contact.wa) throw new Error("Contato sem número.");
  if (contact.opted_out) throw new Error("Contato descadastrado.");

  const c = waConf();

  let payload;
  if (c.templateName) {
    payload = {
      messaging_product: "whatsapp",
      to: contact.wa,
      type: "template",
      template: {
        name: c.templateName,
        language: { code: c.lang },
        components: [
          { type: "body", parameters: [{ type: "text", text: contact.nome }] },
        ],
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      to: contact.wa,
      type: "text",
      text: { body: `Olá! Falo da Adelina sobre a ${contact.nome}.` },
    };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${c.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`WhatsApp Cloud API: ${detail}`);
  }
  return { id: data?.messages?.[0]?.id || null };
}
