# Spec — API Production Readiness (Milestone 2, branch `chore/api-production-readiness`)

> Step 1 of the Development Flow (RULE.md §0). Decisions settled with the developer in a grilling session (2026-11-22).
> Sources: WORKFLOW.md §3, §4 (`users`), §5 (Health, Auth), §7 Milestone 2 tasks 2.1–2.9b;
> ADR-0019, 0020, 0022, 0023, 0031, 0032, 0033, 0035, 0036; RULE.md §5, §7. Builds on [auth.md](auth.md) and [user-profile.md](user-profile.md).

---

## 1. Scope

The API becomes safe to expose on the internet. No new feature for the User; the existing endpoints get the production behaviour.

### In scope

| # | Item | Source |
|---|---|---|
| 2.1 | Schema conventions migration: `timestamptz(3)`, `users.email` `VARCHAR(254)` and unique among non-deleted Users only | ADR-0022, 0023 |
| 2.2 | Prisma CLI uses `DIRECT_DATABASE_URL` (fallback `DATABASE_URL`) | ADR-0036 |
| 2.3 | Refresh cookie `SameSite=Lax`; Origin check on the cookie routes | ADR-0020 |
| 2.4 | `trust proxy` from `TRUST_PROXY`; `Cache-Control: no-store` on every response | ADR-0019, 0020 |
| 2.5 | Rate limiting, M2 rows of ADR-0031 | ADR-0031 |
| 2.6 | pino JSON logs, `X-Request-Id`, `requestId` in error bodies | ADR-0035 |
| 2.7 | `GET /health/ready` (database + Redis); `/health` stays dependency-free | ADR-0035 |
| 2.8 | `openapi:export` script; `apps/api/openapi.json` committed | ADR-0033 |
| 2.9 | Tests for every item (§8) | RULE.md §7 |
| 2.9b | Wording: "account" → "User" in comments and Swagger descriptions | GLOSSARY.md |

### Out of scope

| Item | Planned for |
|---|---|
| CI step `git diff --exit-code` on `openapi.json` | `chore/deploy-pipeline` |
| Production value of `TRUST_PROXY` (measured behind Vercel → Render) | `chore/deploy-pipeline` |
| Login p95 measurement, `bcryptjs` vs `bcrypt` (ADR-0006) | `chore/deploy-pipeline` |
| Sentry, UptimeRobot | `chore/deploy-pipeline` |
| Rate limits of M3–M6 (invitations, messages, uploads, sockets, forgot-password) | M3, M4, M6 |

### Endpoints touched

| Method | Path | Change |
|---|---|---|
| GET | `/api/v1/health/ready` | **New**, `@Public` |
| POST | `/api/v1/auth/register` | Rate limit; email reusable after soft delete |
| POST | `/api/v1/auth/login` | Rate limit; looks up the non-deleted User only |
| POST | `/api/v1/auth/refresh` | Rate limit; Origin check; cookie `SameSite=Lax` |
| POST | `/api/v1/auth/logout` | Origin check |
| PATCH | `/api/v1/users/password` | Rate limit |
| all | all | `Cache-Control: no-store`, `X-Request-Id`, request log line, global rate limit |

### Database

Tables `users`, `refresh_tokens`: one migration, no new table. Not tenant-scoped (no `workspaceId` involved).

---

## 2. Schema Conventions Migration (2.1)

### 2.1.1 Timestamps (ADR-0023)
- Every `DateTime` field in `schema.prisma` is declared `@db.Timestamptz(3)`: `users.last_login_at`, `deleted_at`, `created_at`, `updated_at`; `refresh_tokens.expires_at`, `created_at`.
- The migration converts with `ALTER COLUMN … TYPE timestamptz(3) USING <col> AT TIME ZONE 'UTC'`, **not** the default conversion. The generated SQL is edited and reviewed by hand (ADR-0036).

### 2.1.2 `users.email`
- Type `VARCHAR(254)` (WORKFLOW.md §4). The input schema already caps the email at `MAX_EMAIL_LENGTH`, so no existing row is longer.
- The full unique constraint is replaced by a **partial unique index** `users(email) WHERE deleted_at IS NULL` (ADR-0022).
- Declared in `schema.prisma` with the Prisma 7.10 preview feature `partialIndexes`: `@@unique([email], where: { deletedAt: null })` (checked on 7.10.1; ADR-0022 amended).

### 2.1.3 Repository consequences
A partial index is not a full unique key, so `findUnique({ where: { email } })` no longer applies.
- `UsersRepository.existsByEmail` and `findByEmailWithPassword` use `findFirst({ where: { email, deletedAt: null } })`.
- A soft-deleted User no longer blocks registration with the same email.
- Login behaviour for a soft-deleted User does not change: it still returns the same 401 "Invalid credentials" (it is simply not found).
- Two concurrent registrations with the same email: the database decides (ADR-0032). The loser gets `P2002`, which the filter already maps to 409.

---

## 3. Database URLs (2.2)

- `prisma7.config.ts` uses `DIRECT_DATABASE_URL` when set, otherwise `DATABASE_URL`.
- The running app keeps using `DATABASE_URL` (pooled in production).
- `.env.example` lists `DIRECT_DATABASE_URL` (commented: same value as `DATABASE_URL` locally).

---

## 4. Cookie and Origin Check (2.3)

### 4.1 Refresh cookie
`HttpOnly`; `Secure` in production only; **`SameSite=Lax` in every environment**; `Path=/api/v1/auth`; no `Domain`. Set and clear use the same attributes (auth spec §2.5). Today production uses `SameSite=None`: replaced (ADR-0020).

### 4.2 Origin check
- Applies to the routes that read the refresh cookie: `POST /auth/refresh` and `POST /auth/logout`.
- `Origin` header equal to `FRONTEND_URL` → the request continues.
- `Origin` different **or missing** → `403`, standard error body, message `"Invalid origin"`. No `Referer` fallback.
- Runs before the handler: a rejected request does not read, rotate or delete any session.
- Consequence accepted: calling these routes from Swagger UI (`localhost:3000`) or curl without `Origin` gets 403.

---

## 5. Proxy and Caching (2.4)

### 5.1 `trust proxy`
- New env `TRUST_PROXY`: integer ≥ 0 = number of proxies in front of the API. Validated by Zod at startup. Default `0` (no proxy trusted).
- Applied with `app.set('trust proxy', n)` when `n > 0`. `req.ip` is then the client address that rate limiting and logs use.
- Hop count, never `true`: `true` trusts any `X-Forwarded-For`, so a client could fake its IP and escape the rate limits.

### 5.2 `Cache-Control: no-store`
Set on **every** response: success, error (including 404 for unknown routes and 429), health and docs.

---

## 6. Rate Limiting (2.5)

`@nestjs/throttler`, in-memory storage (ADR-0031, one instance ADR-0018).

### 6.1 Limits

| Scope | Limit | Key |
|---|---|---|
| `POST /auth/login` | 5 / min | IP + normalized email |
| `POST /auth/login` | 20 / min | IP |
| `POST /auth/register` | 5 / hour | IP |
| `POST /auth/refresh` | 30 / min | IP |
| `PATCH /users/password` | 5 / 15 min | User id |
| Any authenticated route | 120 / min | User id |
| Any anonymous route | 60 / min | IP |

### 6.2 Rules
- **Normalized email:** the login key uses the email trimmed and lowercased exactly like `emailSchema`, so `A@x.com ` and `a@x.com` share one counter. If the body has no usable email, only the IP limit applies.
- **Order:** the per-User limits run after `JwtAuthGuard`, so the User id is known. Anonymous requests are keyed by IP.
- **Exempt:** `GET /health` and `GET /health/ready` (`@SkipThrottle`). Render's health check calls liveness often from one internal IP, and a 429 there would make Render restart the service.
- **Response when exceeded:** `429`, header `Retry-After` (seconds), standard error body (Decision #1), message `"Too many requests"`.
- Counters reset on restart: accepted (ADR-0031).

### 6.3 Tests and the throttler
- The throttler stays enabled in every test; no switch in env.
- An E2E helper clears the in-memory throttler storage in `beforeEach`, so each test starts with fresh counters and tests stay independent (RULE.md §7).

---

## 7. Observability and Health (2.6, 2.7)

### 7.1 Logs
- `nestjs-pino`. One line per request: method, route, status, `responseTime`, `requestId`, `userId` (when authenticated). (`workspaceId` from M3.)
- Format and level by environment:

| Env | Format | Default level |
|---|---|---|
| production | JSON | `info` |
| development | `pino-pretty` (devDependency) | `debug` |
| test | — | `silent` (`.env.test`) |

- `LOG_LEVEL` env overrides the default (validated by Zod).
- Pino `redact`: `authorization` header, cookies, `set-cookie`, password fields. Emails and tokens in messages are masked with `mask.util` (RULE.md §5).
- Nest's logger is replaced by pino (`app.useLogger`), so `GlobalExceptionFilter` logs carry the `requestId`.

### 7.2 Request id
- An incoming `X-Request-Id` is reused **only if it is a UUID**; otherwise a new UUID is generated.
- Returned in the `X-Request-Id` header of **every** response.
- Added to **every error body** as `requestId` (`ApiErrorResponse` gains the field). Not added to success bodies.

### 7.3 `GET /api/v1/health` (liveness, unchanged)
Touches neither the database nor Redis. `200 { success: true, data: { status: 'ok', timestamp } }`.

### 7.4 `GET /api/v1/health/ready` (readiness, new)
- `@Public`, exempt from rate limiting.
- Runs two checks **in parallel**, each with a **3 s timeout**:
  - database: `SELECT 1` through Prisma;
  - Redis: `PING`.
- Redis client: `ioredis`, provided by a small `RedisModule`, with `enableOfflineQueue: false`. The app starts even when Redis is down (Redis is disposable, ADR-0027); readiness reports it.
- All up → `200 { success: true, data: { status: 'ok', checks: { database: 'up', redis: 'up' } } }`.
- Any check down or timed out → `503`, standard error body, message `"Service not ready"`, `details` with one entry per failed check: `{ field: 'database' | 'redis', message: 'unreachable' }`.
- Used after a deploy and by hand, never by a frequent pinger (Neon budget, WORKFLOW.md §3).

---

## 8. OpenAPI Contract (2.8)

- `pnpm --filter api openapi:export` writes `apps/api/openapi.json` from the same document Swagger serves (`cleanupOpenApiDoc`).
- Written deterministically: 2-space indent, trailing newline. The file is excluded from Prettier formatting.
- `openapi.json` is committed (ADR-0033).
- An E2E test builds the document from the app and compares it with the committed file. On mismatch it fails with: run `pnpm --filter api openapi:export`. (The CI check of ADR-0033 comes with `chore/deploy-pipeline`.)

---

## 9. Wording (2.9b)

"account" → "User" (GLOSSARY.md) in code comments and Swagger descriptions under `apps/api/src` (7 occurrences, e.g. `'Account created, logged in'` → `'User registered, logged in'`). The Swagger change shows up in `openapi.json`.

---

## 10. Environment Variables

| Key | Required | Default | Notes |
|---|---|---|---|
| `DIRECT_DATABASE_URL` | No | `DATABASE_URL` | Prisma CLI only |
| `TRUST_PROXY` | No | `0` | Integer ≥ 0 |
| `LOG_LEVEL` | No | by `NODE_ENV` (§7.1) | pino levels + `silent` |

All three are added to `.env.example` and validated in `validateEnv`.

---

## 11. Acceptance Criteria

**Migration (2.1)**
- [ ] No column of the `public` schema has type `timestamp without time zone` (`information_schema` check).
- [ ] An instant written to a `timestamptz` column reads back with the same `getTime()`.
- [ ] The migration SQL uses `AT TIME ZONE 'UTC'` and was reviewed by hand.
- [ ] Registering with the email of a soft-deleted User → 201.
- [ ] Registering with the email of a non-deleted User → 409 (unchanged).
- [ ] Two concurrent registrations with the same email (`Promise.all`) → exactly one 201 and one 409.
- [ ] Login with the email of a soft-deleted User whose address was re-registered logs in the new User.

**Database URLs (2.2)**
- [ ] `prisma migrate` uses `DIRECT_DATABASE_URL` when set, `DATABASE_URL` otherwise.

**Cookie and Origin (2.3)**
- [ ] `Set-Cookie` of register / login / refresh has `SameSite=Lax`, `HttpOnly`, `Path=/api/v1/auth`.
- [ ] `/auth/refresh` and `/auth/logout` with `Origin` = `FRONTEND_URL` → unchanged behaviour.
- [ ] With another `Origin` or without `Origin` → 403, and the session row still exists.

**Proxy and caching (2.4)**
- [ ] Every response (200, 4xx, 5xx, unknown route) has `Cache-Control: no-store`.
- [ ] Invalid `TRUST_PROXY` (negative, not a number) → the app refuses to start.

**Rate limiting (2.5)**
- [ ] 6th login within a minute for the same IP + email → 429 with `Retry-After` and the standard error body.
- [ ] The same email with different case / spaces counts against the same limit.
- [ ] 6th registration within an hour from one IP → 429.
- [ ] 6th `PATCH /users/password` within 15 min for one User → 429.
- [ ] `/health` is never rate limited.

**Observability and health (2.6, 2.7)**
- [ ] Every response has an `X-Request-Id` header holding a UUID.
- [ ] An incoming UUID `X-Request-Id` is echoed back; a non-UUID value is replaced.
- [ ] Every error body contains `requestId`, equal to the header.
- [ ] `/health` returns 200 without querying the database or Redis.
- [ ] `/health/ready` → 200 with `database: 'up'`, `redis: 'up'` when both are reachable.
- [ ] `/health/ready` → 503 with a `details` entry for `redis` when Redis is unreachable.

**OpenAPI (2.8)**
- [ ] `openapi:export` writes `apps/api/openapi.json`; running it twice produces no diff.
- [ ] The E2E contract test fails when the committed file differs from the app.

**Quality**
- [ ] No "account" left in `apps/api/src` comments or Swagger descriptions.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.
