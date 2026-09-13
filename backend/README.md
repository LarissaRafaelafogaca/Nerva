# NERVA — Backend

Backend próprio do **NERVA** (acompanhamento de adesão terapêutica e monitoramento clínico em
epilepsia). Substitui completamente a plataforma **Base44**: autenticação, banco de dados,
persistência e regras de negócio agora são locais e sob controle do projeto.

> ⚠️ Ferramenta acadêmica. **Não** diagnostica, prescreve nem recomenda tratamento. Apenas
> registra e calcula indicadores de adesão. Dados de saúde são pessoais sensíveis (LGPD).

## Arquitetura

```
NERVA FRONT-END (React/Vite)
        ↓  REST (fetch)
API REST (Express + TypeScript)
        ↓
SERVICES / BUSINESS LOGIC
        ↓
PRISMA ORM
        ↓
POSTGRESQL
```

O front-end **nunca** acessa o PostgreSQL diretamente. Toda operação passa pela API, que cuida de
autenticação, autorização (RBAC + isolamento por usuário), validação (Zod), regras de negócio,
persistência e tratamento de erros.

## Stack

Node.js · TypeScript · Express · PostgreSQL · Prisma · Zod · JWT (access + refresh) · Argon2 ·
Nodemailer · node-cron · Swagger/OpenAPI · Jest + Supertest.

## Estrutura

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/0001_init/migration.sql
│   └── seed.ts
├── src/
│   ├── config/        env, database (Prisma), auth (JWT)
│   ├── middleware/    auth, rbac, validate (Zod), errorHandler
│   ├── modules/
│   │   ├── auth/      register, otp, login, google, refresh, reset, me
│   │   ├── resources/ camada genérica compatível com o SDK antigo
│   │   ├── doses/     geração de doses, take/skip, adesão
│   │   ├── admin/     pacientes + epidemiologia (agregado)
│   │   └── users/     listagem (admin)
│   ├── jobs/          markMissedDoses (cron)
│   ├── docs/          openapi.ts
│   ├── routes/        agregador
│   ├── app.ts         cria o Express app
│   └── server.ts      sobe o servidor + cron
├── tests/             Jest + Supertest
├── docker-compose.yml PostgreSQL
├── .env.example
└── ANALYSIS.md        relatório de análise do front-end
```

## Pré-requisitos

- Node.js 18+ (testado com 24)
- PostgreSQL 14+ (via Docker ou instalação local)

> **npm 11+** bloqueia scripts de instalação por padrão. Se após `npm install` o Prisma/Argon2 não
> funcionarem, rode: `npm rebuild argon2 @prisma/client @prisma/engines prisma`.

## Passo a passo

### 1. Instalação

```bash
cd backend
npm install
npm rebuild argon2 @prisma/client @prisma/engines prisma   # se necessário (npm 11+)
```

### 2. Configuração do `.env`

```bash
cp .env.example .env
```

Preencha os segredos (nunca commite o `.env`):

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | conexão PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | segredos JWT (fortes) |
| `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | ex.: `15m` / `30d` |
| `SMTP_*` / `MAIL_FROM` | envio de e-mail (OTP e reset). Vazio em dev → códigos são logados no console |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | login com Google |
| `FRONTEND_URL` | destino do redirect pós-OAuth |
| `CORS_ORIGIN` | origem do front-end (ex.: `http://localhost:5173`) |
| `APP_TIMEZONE` | timezone do cron de doses (default `UTC`) |

### 3. Subir o PostgreSQL

Com Docker:

```bash
docker compose up -d
```

Isso sobe o PostgreSQL em `localhost:5432` (usuário/senha/db = `nerva`), compatível com o
`DATABASE_URL` do `.env.example`.

### 4. Migrations

```bash
npx prisma generate      # gera o Prisma Client
npx prisma migrate deploy  # aplica a migration versionada
# (em desenvolvimento, para criar novas migrations: npm run prisma:migrate)
```

### 5. Seed (dados sintéticos — só desenvolvimento)

```bash
npm run seed
```

Cria usuários **fictícios** (senha `Password123`):

- `admin@nerva.test` (admin)
- `paciente@nerva.test` (paciente, com medicamentos/doses/crises/sono/efeitos)
- `paciente2@nerva.test` (paciente)

> Nunca use dados reais de pacientes. O seed é claramente sintético.

### 6. Rodar o backend

```bash
npm run dev     # desenvolvimento (ts-node-dev)
# ou
npm run build && npm start   # produção
```

- API: `http://localhost:4000/api`
- Documentação (Swagger): `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/openapi.json`

### 7. Testes

Os testes usam um PostgreSQL real. Aponte `DATABASE_URL` para um **banco de teste** e rode:

```bash
# exemplo (PowerShell): $env:DATABASE_URL="postgresql://nerva:nerva@localhost:5432/nerva_test?schema=public"
npx prisma migrate deploy    # aplica o schema no banco de teste
npm test
```

Cobrem: autenticação (cadastro, senha incorreta, login, JWT, refresh/rotação, logout, OTP),
isolamento entre usuários, RBAC (usuário comum × admin), doses (geração, take/skip, missed,
adesão, prevenção de duplicação) e CRUD (medicamentos, crises, sono, efeitos colaterais,
preferências com PIN mascarado).

## API — visão geral

Base: `/api`. Autenticação via `Authorization: Bearer <access_token>`. Refresh token em cookie
httpOnly (também aceito no corpo).

### Auth
```
POST /api/auth/register        { email, password, full_name?, profile? }
POST /api/auth/verify-otp      { email, otpCode }  -> { access_token, refresh_token, user }
POST /api/auth/resend-otp      { email }
POST /api/auth/login           { email, password } -> { access_token, refresh_token, user }
POST /api/auth/google          { credential }      (Google One Tap / ID token)
GET  /api/auth/google          (inicia OAuth por redirect)
GET  /api/auth/google/callback (callback OAuth)
POST /api/auth/refresh         { refresh_token? }  -> { access_token, refresh_token }
POST /api/auth/logout          { refresh_token? }
POST /api/auth/forgot-password { email }
POST /api/auth/reset-password  { resetToken, newPassword }
GET  /api/auth/me
PATCH /api/auth/me             { full_name?, profile?, language?, theme?, preferences? }
```

### Recursos (genéricos, compatíveis com o SDK anterior)
`:resource` ∈ `medications`, `dose-logs`, `seizures`, `side-effects`, `sleep-records`.
```
GET    /api/:resource?sort=-created_date&limit=50&filter={"scheduled_date":{"$gte":"2026-08-01"}}
POST   /api/:resource
POST   /api/:resource/bulk           (criação em lote)
PATCH  /api/:resource/bulk           (atualização em lote, cada item com id)
PATCH  /api/:resource/:id
DELETE /api/:resource/:id
POST   /api/:resource/delete-many    { filter }   (sempre no escopo do usuário)
```
Filtros suportam igualdade e operadores `$gte`, `$gt`, `$lte`, `$lt`, `$ne`, `$in`.
`sort` com prefixo `-` = descendente.

### Doses (regras de negócio)
```
GET  /api/doses?date=YYYY-MM-DD           gera/retorna as doses do dia
GET  /api/doses/adherence?days=30         adesão (ou ?from=&to=)
POST /api/doses/:id/take
POST /api/doses/:id/skip
```

### Admin (RBAC)
```
GET /api/admin/patients
GET /api/admin/patients/:id
GET /api/admin/epidemiology        (dados agregados, sem PII)
GET /api/users                     (lista de usuários — admin)
```

## Segurança e privacidade

- **Isolamento por usuário:** o `userId` vem sempre do JWT, nunca do corpo/query. Não-admins só
  acessam seus próprios registros; tentativas de acessar dados alheios retornam `404`.
- **RBAC:** admin = `role=admin` ou `profile=admin`. Endpoints `/api/admin/*` e `/api/users`
  exigem admin.
- **Senhas:** Argon2. **PIN de segurança:** hasheado; nunca retornado em claro (aparece como
  `__set__`).
- **Tokens:** access token curto + refresh token com rotação e revogação (tabela `refresh_tokens`).
- **OTP / reset:** códigos/tokens hasheados, com expiração e uso único.
- **Erros:** tratamento centralizado; sem stack trace ou dados internos em produção.
- **Queries parametrizadas** via Prisma; validação de toda entrada com Zod.
- Segredos apenas via variáveis de ambiente.

## Cron

`markMissedDoses` roda a cada 15 min: marca doses `pending` vencidas como `missed`
(dias anteriores; hoje com 120 min de tolerância), sem tocar `taken`/`skipped`. Timezone via
`APP_TIMEZONE`.

## Integração com o front-end

O front-end continua chamando `base44.entities.*` / `base44.auth.*` / `base44.app.*`, mas
`src/api/base44Client.js` agora é um cliente próprio (`httpClient` + `entityClient` + `authClient`)
que fala com esta API. Configure `VITE_API_URL` no `.env` do front-end (ex.:
`http://localhost:4000/api`). Nenhuma tela, rota ou design foi alterado.

## Notificações push (lembretes de dose) e PWA

O Nerva envia lembretes de medicamento via **Web Push** (VAPID) e é instalável
como **PWA**. Detalhes de uso no celular estão em `../GUIA_PWA_E_LEMBRETES.md`.

- Chaves VAPID no `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (gere com `node -e "console.log(require('web-push').generateVAPIDKeys())"`).
- Endpoints:
  - `GET  /api/push/public-key` — chave pública + flag `enabled`.
  - `POST /api/push/subscribe` — registra a inscrição do dispositivo (auth).
  - `POST /api/push/unsubscribe` — remove a inscrição (auth).
  - `POST /api/push/test` — dispara uma notificação imediata (auth) — usado na demo.
- Agendador (`src/jobs/doseReminders.ts`): a cada minuto envia push das doses
  `pending` do dia cujo horário chegou (janela de 30 min), uma vez por dose
  (`reminder_sent_at`).
- Teste no iPhone requer HTTPS: use o túnel Cloudflare
  (`cloudflared tunnel --url http://localhost:5173`) e instale o PWA na tela inicial.
