# Adelina · Prospecção

Sistema para enviar a proposta da Adelina a pousadas por **e-mail** (SMTP) e **WhatsApp**
(API Oficial da Meta ou link wa.me com 1 clique). Backend Node + Express, banco SQLite,
painel web embutido. Pronto para o **Railway**.

78 pousadas em 9 cidades já vêm carregadas (Ubatuba, Campos do Jordão, Ilhabela,
São Sebastião, Caraguatatuba, Santo Antônio do Pinhal, Monte Verde, São Bento do
Sapucaí, Paraty). Os telefones vêm do Google Maps; o campo de e-mail você preenche
no painel.

---

## Rodar local

```bash
cp .env.example .env      # preencha as variáveis
npm install
npm run seed              # carrega as 78 pousadas no banco (rode uma vez)
npm start                 # http://localhost:3000
```

O painel pede usuário/senha (Basic Auth) definidos em `ADMIN_USER` / `ADMIN_PASS`.

---

## Deploy no Railway

1. Suba este projeto num repositório Git e crie um projeto no Railway a partir dele
   (ou use `railway up` com a CLI). O Railway detecta Node pelo `nixpacks.toml`.
2. Em **Variables**, cole o conteúdo do `.env.example` e preencha:
   - `PUBLIC_URL` → a URL pública do serviço (ex.: `https://seu-app.up.railway.app`).
     É usada nos links de descadastro do e-mail.
   - `ADMIN_USER` / `ADMIN_PASS` → troque a senha.
   - Bloco `SMTP_*` e `MAIL_FROM_EMAIL` (veja "E-mail" abaixo).
   - Bloco `WHATSAPP_*` se for usar a API oficial (opcional).
3. **Persistência:** adicione um **Volume** montado em `/data` e defina
   `DB_PATH=/data/adelina.json`. Sem volume, o banco é apagado a cada deploy.
4. Rode o seed uma vez. Duas opções:
   - Localmente apontando para o mesmo banco, **ou**
   - via Railway: em **Settings → Deploy**, rode um comando único `npm run seed`
     (ou abra um shell no serviço e execute `node src/seed.js`).
5. Abra a URL, faça login e comece.

---

## E-mail (precisa de domínio verificado)

Não use Gmail comum: cai em spam ou bloqueia. Use um provedor transacional e
verifique **SPF, DKIM e DMARC** do seu domínio antes de disparar.

| Provedor | SMTP_HOST | PORTA | USER | PASS |
|---|---|---|---|---|
| Resend | smtp.resend.com | 465 | `resend` | sua API key |
| Brevo | smtp-relay.brevo.com | 587 | seu login | sua chave SMTP |
| Amazon SES | email-smtp.<região>.amazonaws.com | 587 | SMTP user | SMTP pass |

`MAIL_FROM_EMAIL` precisa ser um endereço **do domínio verificado**.
O rodapé de descadastro e o header `List-Unsubscribe` já são adicionados
automaticamente. `EMAIL_THROTTLE_SECONDS` espaça os envios (padrão 8s) para
proteger a reputação.

---

## WhatsApp — leia antes

Há dois caminhos, e a escolha é de conformidade, não de gosto:

**1. Link wa.me (padrão, sem burocracia).** O painel gera um link com a mensagem
já escrita; você clica e envia do seu WhatsApp. É o jeito seguro para começar:
não há automação que viole termos. Funciona sem configurar nada.

**2. API Oficial (WhatsApp Cloud API da Meta).** Para envio programático. Exige
WhatsApp Business + número conectado. Mensagens **frias** (para quem não te
escreveu nas últimas 24h) só podem usar um **template aprovado pela Meta** —
defina `WHATSAPP_TEMPLATE_NAME` e ajuste os `components` em `src/whatsapp.js`
conforme as variáveis do seu template. Para ativar:

```
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=...                 # token do app Meta
WHATSAPP_PHONE_NUMBER_ID=...       # ID do número
WHATSAPP_TEMPLATE_NAME=...         # nome do template aprovado
WHATSAPP_TEMPLATE_LANG=pt_BR
```

> Evite bibliotecas que automatizam um número pessoal (whatsapp-web.js, Baileys)
> para disparo frio em massa: violam os Termos do WhatsApp e o número costuma
> ser banido rapidamente, além do risco sob a LGPD.

---

## Boas práticas (que mantêm tudo funcionando)

- Lotes pequenos, com intervalo. O throttle de e-mail já ajuda.
- Primeira mensagem é apresentação + convite, nunca venda agressiva.
- Respeite descadastros (link automático) e não insista em quem não respondeu.
- Trate os dados como contatos comerciais sob a LGPD: finalidade legítima,
  opção de descadastro e nada de revenda da lista.

## API (resumo)

- `GET /api/status` · `GET /api/contacts?city=&status=` · `PATCH /api/contacts/:id`
- `POST /api/send-email { contactIds }` · `POST /api/send-whatsapp { contactIds }`
- `GET /api/whatsapp/link/:id` · `GET /api/log` · `GET/PUT /api/settings`
- `GET /u/:token` — descadastro público (sem auth)
