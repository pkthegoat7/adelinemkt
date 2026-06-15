import { Contacts } from "./store.js";

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Tipos do tag `tourism` no OSM que cobrem pousadas/hotéis/hostels/etc.
const TYPES = ["hotel", "guest_house", "hostel", "chalet", "motel", "resort", "apartment"];

const slug = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Normaliza telefone para os formatos usados pelo app:
//   wa: dígitos somente, prefixados com 55 (Brasil)
//   fone: string amigável "+55 12 99205-8111"
//   mobile: 1 se for celular (9 dígitos no local + começa com 9)
function parseFone(raw) {
  const only = String(raw || "").replace(/\D/g, "");
  if (!only) return { wa: null, mobile: 0, fone: null };
  let digits = only.startsWith("55") ? only : ((only.length >= 10) ? "55" + only : only);
  if (digits.length < 12 || digits.length > 13) return { wa: null, mobile: 0, fone: null };
  const dd = digits.slice(2, 4);
  const local = digits.slice(4);
  const mobile = local.length === 9 && local.startsWith("9") ? 1 : 0;
  const pretty = "+55 " + dd + " " +
    (local.length === 9
      ? local.slice(0, 5) + "-" + local.slice(5)
      : local.slice(0, 4) + "-" + local.slice(4));
  return { wa: digits, mobile, fone: pretty };
}

function cleanSite(s) {
  if (!s) return "";
  return String(s).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

// OQL: encontra todas acomodações tagueadas dentro de uma area chamada `city`.
// Se a busca por area falhar, faz fallback via nominatim → bounding box.
function buildAreaQuery(city) {
  const safe = city.replace(/["\\]/g, "");
  return `[out:json][timeout:30];
area["name"="${safe}"]->.a;
(
  node["tourism"~"^(${TYPES.join("|")})$"](area.a);
  way["tourism"~"^(${TYPES.join("|")})$"](area.a);
  relation["tourism"~"^(${TYPES.join("|")})$"](area.a);
);
out center tags;`;
}

async function runOverpass(oql, timeoutMs = 35_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Adelina-Prospeccao/1.0 (https://adelina.up.railway.app)",
      },
      body: "data=" + encodeURIComponent(oql),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Overpass HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ""}`);
  }
  return res.json();
}

export async function discoverByCity(city) {
  const cleanCity = String(city || "").trim();
  if (!cleanCity) throw new Error("Cidade vazia.");

  const data = await runOverpass(buildAreaQuery(cleanCity));
  const elements = data.elements || [];

  // dedup por nome dentro do resultado (alguns elementos vêm duplicados como
  // node E way pro mesmo lugar)
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const nome = (tags.name || "").trim();
    if (!nome) continue;
    const tipo = tags.tourism;
    if (!TYPES.includes(tipo)) continue;

    const key = slug(nome);
    if (seen.has(key)) continue;
    seen.add(key);

    const phoneRaw = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "";
    const parsed = parseFone(phoneRaw);
    const site = cleanSite(tags.website || tags["contact:website"] || "");
    const email = (tags.email || tags["contact:email"] || "").trim() || null;

    const id = slug(cleanCity) + "__" + slug(nome);
    const exists = !!Contacts.get(id);

    out.push({
      id,
      nome,
      cidade: cleanCity,
      tipo,
      fone: parsed.fone,
      wa: parsed.wa,
      mobile: parsed.mobile,
      site,
      email,
      source: "osm",
      osm_id: el.type + "/" + el.id,
      existsInDb: exists,
    });
  }

  // ordena: novos primeiro, depois alfabético
  out.sort((a, b) => {
    if (a.existsInDb !== b.existsInDb) return a.existsInDb ? 1 : -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return out;
}

export function importCandidates(items) {
  let added = 0, skipped = 0;
  const addedIds = [];
  for (const it of items || []) {
    if (!it || !it.nome || !it.cidade) { skipped++; continue; }
    if (Contacts.get(it.id)) { skipped++; continue; }
    const c = Contacts.add({
      id: it.id,
      nome: it.nome,
      cidade: it.cidade,
      fone: it.fone || null,
      wa: it.wa || null,
      mobile: it.mobile ? 1 : 0,
      site: it.site || "",
      rating: null,
      avals: null,
      email: it.email || null,
    });
    added++;
    addedIds.push(c.id);
  }
  return { added, skipped, ids: addedIds };
}
