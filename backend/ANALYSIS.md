# NERVA — Relatório de Análise (Fase 1 e 2)

Este documento resume a análise do front-end existente e a arquitetura proposta para o
backend próprio que substitui a plataforma Base44. É a fonte de verdade para o schema do
banco, os endpoints e as alterações mínimas no front-end.

---

## 1. Tecnologia do front-end

- **Framework:** React 18 + Vite, React Router v6, TailwindCSS, Radix UI, Recharts.
- **Estado de servidor:** `@tanstack/react-query` (presente, mas as páginas usam `useEffect` +
  chamadas diretas ao SDK na maior parte).
- **Backend atual:** plataforma **Base44** via SDK `@base44/sdk`, inicializado em
  `src/api/base44Client.js` com `createClient({ appId, token, functionsVersion, serverUrl: '', appBaseUrl })`.
- **Armazenamento atual dos dados:** todos os dados persistentes vivem no backend da Base44,
  acessados por `base44.entities.<Entidade>` e `base44.auth`. Preferências de UI (tema, idioma,
  notificações) são espelhadas em `localStorage` e sincronizadas com o usuário via `auth.updateMe`.
- **Token:** bearer token em `localStorage` (`base44_access_token` / `token`), enviado como
  `Authorization: Bearer <token>`.

## 2. Dependências da plataforma anterior (a remover)

- `@base44/sdk` (client + `getAccessToken`).
- Variáveis `VITE_BASE44_*`.
- Endpoints MCP OAuth em `OAuhConsent.jsx` (`/api/apps/:appId/mcp/*`) — **funcionalidade opcional**,
  não faz parte do núcleo do app; não será reimplementada no backend próprio.
- Nenhum uso de `base44.integrations.*` nem `base44.functions.*` (sem SendEmail/InvokeLLM/UploadFile
  no código do app). E-mail (OTP/reset) era feito internamente pela Base44 → agora será SMTP próprio.

## 3. Estratégia de integração (alteração mínima no front-end)

O SDK expõe uma superfície estável usada em ~10 páginas. Em vez de reescrever cada página,
**reimplementamos a superfície do SDK** num shim local (`src/api/base44Client.js`) que fala com
a nova API REST. Assim preservamos design, rotas, componentes e chamadas existentes.

Superfície a reproduzir:

- `base44.entities.<E>`: `list(sort?, limit?)`, `filter(query)`, `create(obj)`, `update(id, partial)`,
  `delete(id)`, `deleteMany(query)`, `bulkCreate(array)`, `bulkUpdate(arrayComId)`.
  - `sort`: string tipo `'-date_time'` (prefixo `-` = desc).
  - `filter`/`deleteMany` query: match exato **e** operador `{ campo: { $gte: valor } }`.
- `base44.auth`: `me()`, `updateMe(partial)`, `loginViaEmailPassword(email, password)`,
  `loginWithProvider('google', returnTo)`, `register({email,password})`,
  `verifyOtp({email,otpCode})` → `{ access_token }`, `resendOtp(email)`,
  `resetPasswordRequest(email)`, `resetPassword({resetToken,newPassword})`,
  `setToken(token)`, `logout(redirect?)`, `redirectToLogin(url)`.
- `base44.app.getPublicSettings()` → `{ id, public_settings }`.

Campos de sistema que o front-end lê em todo registro e que o backend **deve** retornar:
`id`, `created_by_id` (dono), `created_date` (ISO). No usuário: `id, email, full_name, role,
profile, language, theme, preferences, created_date`.

## 4. Entidades identificadas (nomes de campo preservados do front-end)

| Entidade    | Campos (casing exato do FE) |
|-------------|------------------------------|
| **User**    | `id, email, full_name, role(admin\|user), profile(admin\|patient), language, theme, preferences{notifications,security,privacy}, email_verified, created_date` |
| **Medication** | `id, name*, dosage, frequency, times[], color(enum), notes, active, created_by_id, created_date` |
| **DoseLog** | `id, medication_id*, medication_name, scheduled_date*, scheduled_time, status(pending\|taken\|missed\|skipped), taken_at, notes, created_by_id, created_date` |
| **Seizure** | `id, date_time*, type(enum), duration_minutes, severity(enum), triggers[], notes, created_by_id, created_date` |
| **SideEffect** | `id, date*, medication_id, medication_name, description*, severity(enum), notes, created_by_id, created_date` |
| **SleepRecord** | `id, date*, hours*, quality(enum), bedtime, wake_time, notes, created_by_id, created_date` |

(*) obrigatório.

## 5. Operações necessárias por entidade

- **Medication:** list, list('-created_date'), create, update, delete, deleteMany(created_by_id).
- **DoseLog:** filter(scheduled_date exato), filter(status), filter(scheduled_date $gte),
  filter(medication_id), list('-created_date',500), create, bulkCreate, update, bulkUpdate,
  delete, deleteMany(medication_id | created_by_id).
- **Seizure/SideEffect/SleepRecord:** list(sort,limit), create, update, delete, deleteMany(created_by_id).
- **User:** list() (admin), me(), updateMe(partial).

## 6. Fluxos de autenticação

1. **Cadastro tradicional:** `register({email,password})` cria usuário não verificado + envia OTP.
   `verifyOtp({email,otpCode})` verifica e retorna `access_token` (+ refresh via cookie/body).
   Depois `updateMe({profile, full_name})`.
2. **Login tradicional:** `loginViaEmailPassword` → access + refresh.
3. **Google:** `loginWithProvider('google', returnTo)` redireciona ao Google; callback troca por
   sessão. Usuário Google não tem senha local (`password_hash` nullable, `provider='google'`).
4. **Refresh/Logout:** access token curto + refresh token revogável (tabela `refresh_tokens`).
5. **Reset de senha:** `resetPasswordRequest(email)` (sem enumeração), `resetPassword({resetToken,newPassword})`.
6. **me():** retorna usuário autenticado a partir do JWT.

## 7. Persistência e privacidade

- Persistente no PostgreSQL: usuários, medicamentos, doses, crises, sono, efeitos colaterais,
  tokens de refresh, tokens de verificação/reset. Preferências/tema/idioma também no `User`.
- Dados exclusivos do usuário autenticado: todas as entidades de dados (RLS dono-ou-admin).
- Admin (`role=admin` ou `profile=admin`): endpoints administrativos agregados.
- Dados de saúde são sensíveis (LGPD): segredos via env, senhas com Argon2, sem PII em logs/erros,
  queries parametrizadas via Prisma, dados sintéticos em seed/testes.

## 8. Endpoints da API REST

Auth: `POST /api/auth/register`, `/verify-otp`, `/resend-otp`, `/login`, `/google`,
`/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/me`;
`PATCH /api/auth/me`.

App: `GET /api/app/public-settings`.

Entidades genéricas (compatível com o SDK), por recurso
(`medications`, `dose-logs`, `seizures`, `side-effects`, `sleep-records`, `users`):
- `GET /api/:resource` (query `sort`, `limit`, `filter` JSON)
- `POST /api/:resource`
- `POST /api/:resource/bulk` (bulkCreate)
- `PATCH /api/:resource/bulk` (bulkUpdate)
- `PATCH /api/:resource/:id`
- `DELETE /api/:resource/:id`
- `POST /api/:resource/delete-many` (deleteMany por query)

Doses/negócio (adicionais, opcionais para o FE atual mas exigidos pela spec):
`GET /api/doses?date=YYYY-MM-DD`, `POST /api/doses/:id/take`, `POST /api/doses/:id/skip`,
`GET /api/doses/adherence?days=30`.

Admin: `GET /api/admin/patients`, `GET /api/admin/patients/:id`, `GET /api/admin/epidemiology`.

## 9. Regras de negócio (backend)

- **Geração de doses:** para medicamentos ativos, criar `DoseLog` pending por `times[]` numa data,
  evitando duplicação (unique `created_by_id + medication_id + scheduled_date + scheduled_time`).
- **Missed:** cron marca `pending` vencidas como `missed` (dias anteriores; ou hoje com 120 min de
  tolerância), sem tocar `taken`/`skipped`.
- **Adesão:** `taken / (taken+missed+skipped) * 100` em janelas de 7/30/dias custom.

## 10. Possíveis incompatibilidades e decisões

- **`created_by_id`/`created_date`:** Base44 injeta esses campos; reproduzimos no backend
  (`created_by_id` = dono; `created_date` = createdAt em ISO). O front-end filtra por eles.
- **Operador `$gte`:** a API traduz `filter` JSON → Prisma `where` (suporta match exato e `$gte`).
- **`sort` com prefixo `-`:** traduzido para `orderBy desc`. Default de `list()` sem args:
  `created_date desc`.
- **PIN em `preferences.security.pin`:** o FE guarda o PIN em claro; o backend **hasheia** antes de
  persistir (nunca devolve o hash em claro; devolve marcador `set:true`/mascara).
- **Timezone:** o FE usa `toISOString()` (UTC) para datas e hora local para tolerância. O backend
  trata datas como `YYYY-MM-DD`/ISO e o cron aceita `APP_TIMEZONE` (default UTC), estruturado para
  timezone por usuário no futuro.
- **`verifyOtp` retorna `{access_token}`:** mantido; refresh token vai no corpo e/ou cookie httpOnly.
- **Google login por redirect:** implementado via `GET /api/auth/google` (redirect) +
  `GET /api/auth/google/callback`. O shim expõe `loginWithProvider` como redirect de página.

## 11. Alterações mínimas necessárias no front-end

1. Substituir `src/api/base44Client.js` por um shim que fala com a API REST (mesma superfície).
2. Remover import de `@base44/sdk` em `src/lib/app-params.jsx` (usar token do `localStorage`).
3. Adicionar `.env` com `VITE_API_URL`.
4. Nenhuma alteração em páginas, componentes, layout, textos, rotas ou design.

## 12. Arquitetura final

```
NERVA FRONT-END (React/Vite)
        ↓  (SDK shim → fetch)
API REST (Express + TypeScript)
        ↓
SERVICES / BUSINESS LOGIC
        ↓
PRISMA ORM
        ↓
POSTGRESQL
```
