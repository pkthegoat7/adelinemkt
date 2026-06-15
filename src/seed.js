import "dotenv/config";
import { seedContacts, contactCount } from "./store.js";

const CITIES = {
  "Ubatuba": [
    ["Ubatuba Praia Hotel", 4.9, 1616, "+55 12 99205-8111", "ubatubapraiahotel.com"],
    ["Pousada do Itaguá", 4.8, 212, "+55 12 98883-1001", "instagram.com/pousadadoitagua.ubatuba"],
    ["UPG Hotel", 4.6, 9367, "+55 12 99637-2349", "ubatubapraiagrandehotel.com.br"],
    ["Green Haven Hostel", 4.6, 1158, "+55 12 99758-2833", "greenhaven.com.br"],
    ["Pousada Beira Mar", 4.5, 851, "+55 12 99656-7639", "beiramarubatuba.com.br"],
    ["Hotel Coquille", 4.6, 1181, "+55 12 3835-1611", "hotelcoquille.com"],
    ["Pousada Don Diego", 4.6, 620, "+55 12 3832-2338", "pousadadondiego.com.br"],
    ["Pousada Papito", 4.6, 694, "+55 12 3833-8086", "linktr.ee/papito.hospedagem"],
    ["Pousada Recanto Itaguá", 4.6, 217, "+55 12 3832-6630", ""],
    ["Hotel São Charbel", 4.5, 1079, "+55 12 3832-1080", "hotelsaocharbel.com.br"],
    ["Hotel Nacional Inn — Toninhas", 4.5, 1344, "+55 12 2122-4884", "nacionalinn.com.br"],
    ["Pousada Pé na Areia", 4.4, 403, "+55 12 3042-5126", ""],
    ["Pousada Vison — Praia Grande", 4.4, 410, "+55 12 3835-1822", "pousadavisonubatuba.soufoco.com.br"],
  ],
  "Campos do Jordão": [
    ["Pousada Hortelã Village", 5.0, 178, "+55 12 99776-5621", "hortelavillage.com.br"],
    ["Pousada Hortelã", 4.9, 437, "+55 12 99676-5621", "pousadahortela.com.br"],
    ["Pousada Caminho das Pedras", 4.9, 1246, "+55 12 99201-0108", "pousadacaminhodaspedras.com.br"],
    ["Hotel Sagres", 4.8, 705, "+55 12 99663-1555", "hotelsagres.com.br"],
    ["Pousada Cantinho da Serra", 4.8, 516, "+55 12 3663-8489", "pousadacantinhodaserra.com.br"],
    ["Pousada Jardon — só adultos", 4.7, 754, "+55 12 3500-8867", "pousadajardon.com.br"],
    ["Pousada Santha Serra", 4.7, 699, "+55 12 3512-0562", "nacionalinn.com.br"],
    ["Pousada Moderna", 4.6, 729, "+55 12 3663-1068", "pousadamoderna.com.br"],
    ["Pousada da Lua", 4.6, 264, "+55 12 3663-2934", "pousadadalua.com.br"],
    ["Hotel Castelo Nacional Inn", 4.5, 4270, "+55 12 3512-0562", "nacionalinn.com.br"],
    ["Hotel Nacional Inn", 4.5, 3323, "+55 12 3512-0562", "nacionalinn.com.br"],
    ["Hotel Euro Suite", 4.5, 574, "+55 12 3512-0562", "nacionalinn.com.br"],
    ["Dan Inn", 4.4, 3735, "+55 12 3512-0562", "nacionalinn.com.br"],
  ],
  "Ilhabela": [
    ["Pousada Suítes Vista pro Mar", 4.9, 287, "+55 12 99216-7695", ""],
    ["Vila Bambu", 4.7, 338, "+55 11 97455-2431", ""],
    ["Recanto Da Villa", 4.6, 861, "+55 12 99178-6437", ""],
    ["Pousada Altamira", 4.6, 370, "+55 12 3896-5394", ""],
    ["Plaza Inn Pousada do Capitão", 4.5, 510, "+55 12 3896-1037", ""],
    ["Pousada Montemar", 4.4, 1242, "+55 12 3896-1326", ""],
    ["Velinn Feiticeira Praia Hotel", 4.4, 837, "+55 12 3895-1225", ""],
    ["Hotel Pelicano", 3.9, 792, "+55 12 3896-1213", ""],
  ],
  "São Sebastião": [
    ["Pousada Pé da Mata", 4.6, 377, "+55 12 99770-3330", ""],
    ["Pousada Vila Barequeçaba", 4.5, 854, "+55 12 3211-4679", ""],
    ["Chez Louise et Louis", 4.5, 502, "+55 12 3863-1103", ""],
    ["Pousada Azul Banana", 4.4, 462, "+55 12 3865-7211", ""],
    ["Pousada Aconchego Canto do Mar", 4.3, 332, "+55 12 99711-3359", ""],
    ["Pousada Villa Encanto", 4.3, 313, "+55 12 99635-8762", ""],
    ["Casatua Pousada Juquehy", 4.2, 171, "+55 12 3863-2225", ""],
  ],
  "Caraguatatuba": [
    ["Hostel Lê Castelle", 4.9, 71, "+55 12 99156-4354", ""],
    ["Chalé Caiçara", 4.8, 804, "+55 12 98155-0422", ""],
    ["Pousada Sol e Lua", 4.6, 65, "+55 12 3888-2611", ""],
    ["Pousada Jofisa", 4.4, 311, "+55 12 3882-2082", ""],
    ["Pousada Yurgs", 4.2, 202, "+55 12 2018-0611", ""],
    ["Ilha Morena", 4.2, 4373, "+55 12 3887-2344", ""],
    ["Pousada Riviera", 3.9, 179, "+55 12 3887-2344", ""],
  ],
  "Santo Antônio do Pinhal": [
    ["Pousada Girassol", 4.8, 251, "+55 11 91439-7964", ""],
    ["Pousada Poesia da Mantiqueira", 4.8, 31, "+55 12 99727-3840", ""],
    ["Chalés Vista Linda", 4.7, 53, "+55 12 99738-0333", ""],
    ["Pousada IL Villaggio", 4.7, 429, "+55 12 3666-1300", ""],
    ["Pousada Santo Antônio do Pinhal", 4.4, 258, "+55 12 99770-7575", ""],
    ["Pousada Alemã", 4.4, 508, "+55 12 3666-1360", ""],
    ["Pousada Beira Rio", 4.2, 311, "+55 12 99733-0501", ""],
  ],
  "Monte Verde": [
    ["Pousada Cantinho de Monte Verde", 4.8, 626, "+55 35 3438-1320", ""],
    ["Pousada Valle das Flores", 4.8, 645, "+55 35 3438-2543", ""],
    ["Pousada Serras de Monte Verde", 4.7, 565, "+55 35 3438-2739", ""],
    ["Pousada Villa Monte Verde", 4.7, 756, "+55 35 3438-2399", ""],
    ["Velinn Locanda Belvedere", 4.6, 377, "+55 12 3895-1225", ""],
    ["Pousada Refúgio do Selado", 4.5, 212, "+55 35 98891-8578", ""],
    ["Pinho Verde", 4.3, 323, "+55 35 3438-1138", ""],
  ],
  "São Bento do Sapucaí": [
    ["Pousada Chalés da Estalagem", 4.9, 420, "+55 12 99642-5077", ""],
    ["Pousada 4 Irmãos", 4.9, 143, "+55 12 99202-1314", ""],
    ["Pousada Lua Bonita", 4.9, 159, "+55 12 99209-7730", ""],
    ["Pousada Villa dos Quilombolas", 4.8, 95, "+55 12 3971-1472", ""],
    ["Pousada Solar dos Colibris", 4.8, 199, "+55 12 99175-5198", ""],
    ["Pousada Villa Mountain", 4.7, 216, "+55 12 99671-1268", ""],
    ["Chalés Montanha", 4.6, 191, "+55 12 99762-9590", ""],
    ["Pousada Refúgio Mantiqueira", 4.6, 175, "+55 11 98959-3178", ""],
  ],
  "Paraty": [
    ["Pousada das Saíras", 4.8, 116, "+55 24 99937-3605", ""],
    ["Pousada Villa Tiê", 4.8, 493, "+55 24 99991-2812", ""],
    ["Casa Luz", 4.6, 397, "+55 24 99259-7882", ""],
    ["Pousada Estrela do Mar", 4.5, 746, "+55 24 98877-6514", ""],
    ["Pousada Casa do Rio Hostel", 4.5, 1287, "+55 24 3371-2223", ""],
    ["Pousada Fantasia", 4.5, 222, "+55 24 99983-4827", ""],
    ["HOTELARE Brunello", 4.4, 845, "+55 24 98843-6825", ""],
    ["Pousada Conchas de Paraty", 4.3, 381, "+55 24 3371-2799", ""],
  ],
};

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function parseFone(raw) {
  const only = (raw || "").replace(/\D/g, "");
  const digits = only.startsWith("55") ? only : "55" + only;
  const local = digits.slice(4);
  return { wa: digits, mobile: local.length === 9 && local.startsWith("9") };
}

const rows = [];
for (const [cidade, lista] of Object.entries(CITIES)) {
  for (const [nome, rating, avals, fone, site] of lista) {
    const { wa, mobile } = parseFone(fone);
    rows.push({ id: `${slug(cidade)}__${slug(nome)}`, nome, cidade, rating, avals, fone, site, wa, mobile });
  }
}

seedContacts(rows);
console.log(`Seed concluído. ${rows.length} contatos. Total no banco: ${contactCount()}.`);
