# Tasks — API Production Readiness (Milestone 2, branch `chore/api-production-readiness`)

> Step 3 of the Development Flow (RULE.md §0): Task Decomposition.
> Implements [docs/plans/api-production-readiness.md](../plans/api-production-readiness.md) for [docs/specs/api-production-readiness.md](../specs/api-production-readiness.md).

**How to use this file:** one task per turn. Each task is a vertical slice: **Red** (the failing test, run and seen failing for the expected reason) → **Green** (the minimal code) → one commit. Tick the box when committed. Paths are relative to `apps/api/` unless they start with `/`.

**⚠️ = learning mode (ADR-0039):** the agent writes the failing test and shows it red; **the developer writes the code** that turns it green; the agent then runs the suite and reviews the code against RULE.md.

**Seams:** S1–S8 of the plan §6. No test at another seam without asking.

**Done for every task:** the new test was red for the expected reason, is now green; `pnpm --filter api lint && pnpm --filter api typecheck` pass; the related test files pass (`test` and/or `test:e2e`); functions ≤ 30 lines and ≤ 3 parameters; no `any` / `!` / unjustified `as`.

---

## Dependency Order

```
P0  dependencies + env keys (setup, no behaviour)
Schema (2.1)
  P1 ⚠️ migration: timestamptz + email VARCHAR(254) + partial unique index
  P2    login / register on the new index (S1)
HTTP hardening
  P3    request id + requestId in error bodies (S7, S4)
  P4 ⚠️ cookie SameSite=Lax + OriginGuard (S3)
  P5    Cache-Control: no-store + TRUST_PROXY (S7, S4)
Rate limiting (2.5)
  P6    credentialsKey (S7) + test helper resetThrottler
  P7 ⚠️ AppThrottlerGuard, named throttlers, login / register / refresh limits (S5)
  P8    per-User limits, password limit, health exempt (S5)
Logs (2.6)
  P9    pino options: levels, redact, pretty in dev (S7)
Health (2.7)
  P10   withTimeout (S7) + RedisModule
  P11   GET /health/ready (S6)
Contract and wiring (2.8, 2.2, 2.9b)
  P12   openapi:export + contract test (S7, S8)
  P13   DIRECT_DATABASE_URL, tsconfig fix, wording "account" → "User"
Verification
  P14   full suite, review, refactor, docs, PR, knowledge summary
```

P3 comes before P4–P8 because their error assertions include `requestId`. P5 (`TRUST_PROXY`) comes before P7 (spoofing test). P12 is last so `openapi.json` contains every change.

---

## Setup

### - [x] P0. Dependencies and env keys

| | |
|---|---|
| Install | `@nestjs/throttler`, `nestjs-pino`, `pino`, `pino-http`, `ioredis`; dev: `pino-pretty` |
| Env | `.env.example`: `DIRECT_DATABASE_URL`, `TRUST_PROXY=0`, `LOG_LEVEL` (commented). Local `.env.test`: `LOG_LEVEL=silent`, `TRUST_PROXY=0` |
| Test | None (no behaviour). Proof: `pnpm install`, `pnpm typecheck`, `pnpm test` still green |

---

## Schema (2.1)

### - [x] P1. ⚠️ Schema conventions migration

| | |
|---|---|
| **Red** (agent) | New `test/schema-conventions.repository.e2e-spec.ts` (S2): `should have no timestamp column without time zone in the public schema` (query `information_schema.columns`); `should read back the same instant that was written` (`lastLoginAt` with milliseconds, compare `getTime()`). Red today: 6 columns are `timestamp without time zone` |
| **Green** (developer) | `schema.prisma`: `previewFeatures = ["partialIndexes"]`, `@db.Timestamptz(3)` on the 6 fields, `email @db.VarChar(254)`, `@@unique([email], where: { deletedAt: null })` replacing `@unique`. `prisma migrate dev --create-only --name schema_conventions`, then **edit the SQL by hand**: every `ALTER COLUMN … TYPE TIMESTAMPTZ(3) USING "<col>" AT TIME ZONE 'UTC'`. Read the whole file before applying. Apply to dev and test DBs |
| Review points | No `DROP COLUMN`; index name and `WHERE "deleted_at" IS NULL` present; `prisma migrate dev` afterwards reports no drift |

### - [x] P2. Login and register on the partial index

| | |
|---|---|
| **Red** | `test/auth.e2e-spec.ts` (S1): `should register with the email of a soft-deleted User`; `should log in the new User when an old User with the same email was soft-deleted`; `should return 201 for one and 409 for the other when two registrations with the same email race` (`Promise.all`). The existing "duplicate email → 409" stays. Red: `findUnique` on `email` still compiles (Prisma keeps `email` in `UserWhereUniqueInput` for a partial index) but finds the soft-deleted row at runtime |
| **Green** | `users.repository.ts`: `existsByEmail`, `findByEmailWithPassword` → `findFirst({ where: { email, deletedAt: null } })`; update their comments |
| Note | Soft-deleted User set up with `prisma.user.update` in the test (setup, not assertion) |

---

## HTTP hardening

### - [x] P3. Request id and `requestId` in error bodies

| | |
|---|---|
| **Red 1** (unit, S7) | `common/logging/__tests__/request-id.spec.ts`: returns an incoming UUID unchanged; replaces a non-UUID (`"abc"`, `"' OR 1=1"`), an empty value and an array header with a new UUID |
| **Green 1** | `common/logging/request-id.ts`: `resolveRequestId(header: unknown): string` |
| **Red 2** (S4) | New `test/http-hardening.e2e-spec.ts`: every response has a UUID `X-Request-Id`; an incoming UUID is echoed; an error body has `requestId` equal to the header. `errorBodySchema` in helpers gains `requestId` |
| **Green 2** | `LoggerModule.forRootAsync` in `AppModule` (minimal options: `genReqId`, sets header); `GlobalExceptionFilter` adds `request.id`; `ApiErrorResponse.requestId`; `setupApp`: `app.useLogger(app.get(Logger))`; `main.ts`: `bufferLogs: true`. Filter logs through the pino logger |

### - [x] P4. ⚠️ Cookie `SameSite=Lax` and `OriginGuard`

| | |
|---|---|
| **Red** (agent, S3) | `test/auth.e2e-spec.ts`: `Set-Cookie` of login has `SameSite=Lax`; refresh with a wrong `Origin` → 403 and the session row still works afterwards (a second refresh with the right Origin → 200); same without `Origin`; logout with a wrong `Origin` → 403 and the session survives. Update `refresh`/logout helpers to send `Origin: FRONTEND_URL` by default. Unit `refresh-cookie.spec.ts`: `sameSite: 'lax'` in production too |
| **Green** (developer) | `refresh-cookie.ts`: `sameSite: 'lax'` always (update the comment: same-origin proxy, ADR-0020). `common/guards/origin.guard.ts`: reads `appConfig.frontendUrl`, compares with `request.headers.origin`, throws `ForbiddenException('Invalid origin')`. `@UseGuards(OriginGuard)` on `refresh` and `logout` |
| Review points | Exact string comparison (no `startsWith`/`includes`); missing header → 403; no session read before the guard |

### - [ ] P5. `Cache-Control: no-store` and `TRUST_PROXY`

| | |
|---|---|
| **Red 1** (unit, S7) | `config/__tests__/app.config.spec.ts`: `TRUST_PROXY` defaults to 0, accepts `"2"`, rejects `"-1"`, `"true"`, `"1.5"`; `LOG_LEVEL` accepts pino levels + `silent`, rejects others |
| **Green 1** | `app.config.ts`: `TRUST_PROXY: z.coerce.number().int().min(0).default(0)` (with a guard against `"true"` coercing), `LOG_LEVEL` enum optional |
| **Red 2** (S4) | `http-hardening.e2e-spec.ts`: `Cache-Control: no-store` on `GET /health`, on a 401 (`/auth/me` without token), on a 400, on an unknown route (404) |
| **Green 2** | `setup-app.ts`: middleware setting the header first; `trust proxy` set from config when > 0 |

---

## Rate limiting (2.5)

### - [ ] P6. `credentialsKey` and `resetThrottler`

| | |
|---|---|
| **Red** (unit, S7) | `common/throttling/__tests__/credentials-key.spec.ts`: `("1.2.3.4", { email: " A@X.com " })` → `"1.2.3.4:a@x.com"`; missing / invalid email / non-object body → `undefined` |
| **Green** | `common/throttling/credentials-key.ts` (reuses `emailSchema.safeParse`); `common/throttling/throttle.constants.ts` (limits of spec §6.1) |
| Also | `test/utils/throttler.ts`: `resetThrottler(app)`; added to `beforeEach` of every e2e file (no effect yet; ready for P7) |

### - [ ] P7. ⚠️ `AppThrottlerGuard`: login, register, refresh limits

| | |
|---|---|
| **Red** (agent, S5) | New `test/rate-limit.e2e-spec.ts`: 6th login (same IP + email, wrong password) → 429 with `Retry-After` and the standard error body (`requestId`, message `"Too many requests"`); `"A@x.com"` and `"a@x.com "` share the counter; 6th register from one IP → 429; with `TRUST_PROXY=0`, changing `X-Forwarded-For` does not reset the login counter |
| **Green** (developer) | `ThrottlerModule.forRootAsync` in `AppModule` with named throttlers `anonymous`, `credentials` (plan §3.1); `common/guards/app-throttler.guard.ts`: `getTracker` per throttler, `credentials` skipped unless the route enables it, `Retry-After` set; registered in `AuthModule` right after `JwtAuthGuard`; `@Throttle` on login / register / refresh |
| Review points | Tracker uses `req.ip` only (never a raw header); counters per throttler name; `credentials` key never logged unmasked |

### - [ ] P8. Per-User limits, password limit, health exempt

| | |
|---|---|
| **Red** (S5) | `rate-limit.e2e-spec.ts`: 6th `PATCH /users/password` within 15 min for one User → 429 (another User is not affected); 70 rapid `GET /health` → all 200 |
| **Green** | Throttler `user` (120 / min, key User id, skipped without `request.user`); `anonymous` skipped when `request.user` is set; `@Throttle` on `PATCH /users/password`; `@SkipThrottle()` on `HealthController` |

---

## Logs (2.6)

### - [ ] P9. pino options: levels, redact, pretty in dev

| | |
|---|---|
| **Red** (unit, S7) | `common/logging/__tests__/logger.options.spec.ts`: level by env (`production` → `info`, `development` → `debug`, `LOG_LEVEL` wins); transport `pino-pretty` only in development; **a log line written through the options to an in-memory stream** for a request with `Authorization`, `Cookie` and a body `password` contains none of those values |
| **Green** | `common/logging/logger.options.ts`: `buildLoggerOptions(config)` (level, transport, `redact`, `customProps` with `userId`, `genReqId`); `LoggerModule` uses it |

---

## Health (2.7)

### - [ ] P10. `withTimeout` and `RedisModule`

| | |
|---|---|
| **Red** (unit, S7) | `common/utils/__tests__/with-timeout.util.spec.ts` (Jest fake timers): resolves with the value when the promise settles first; rejects after `ms` when it does not; rejects with the original error when the promise rejects first |
| **Green** | `common/utils/with-timeout.util.ts`; `src/redis/redis.module.ts` + `redis.constants.ts` (global `REDIS_CLIENT`, `lazyConnect`, `enableOfflineQueue: false`, `quit()` on destroy), imported in `AppModule` |

### - [ ] P11. `GET /health/ready`

| | |
|---|---|
| **Red** (S6) | New `test/health.e2e-spec.ts`: `/health/ready` → 200 `{ status: 'ok', checks: { database: 'up', redis: 'up' } }`; with `REDIS_CLIENT` overridden by a real client on an unused port → 503, standard body, `details: [{ field: 'redis', message: 'unreachable' }]`, within 3 s. `createTestApp(overrides?)` in helpers |
| **Green** | `health.repository.ts` (`pingDatabase` with `$queryRaw\`SELECT 1\``), `HealthService.ready()`, `readiness-response.dto.ts`, `@Get('ready')` with `@ZodResponse` |
| Also | Existing `health.service.spec.ts` / `health.controller.spec.ts` stay green |

---

## Contract and wiring

### - [ ] P12. `openapi:export` and contract test

| | |
|---|---|
| **Red 1** (unit, S7) | `openapi/__tests__/openapi-document.spec.ts`: `serializeOpenApi({ b: 1, a: [1] })` equals the literal 2-space JSON with a trailing newline |
| **Red 2** (S8) | New `test/openapi.e2e-spec.ts`: the document built from the app equals the committed `openapi.json`; on mismatch the message says `run pnpm --filter api openapi:export`. Red: the file does not exist |
| **Green** | `src/openapi/openapi-document.ts` (`buildOpenApiDocument`, `serializeOpenApi`); `setupSwagger` uses it; `src/scripts/export-openapi.ts`; `package.json` script; `/.prettierignore`; run the export and commit `openapi.json` |
| Proof | Running the export twice → no diff |

### - [ ] P13. `DIRECT_DATABASE_URL`, tsconfig, wording

| | |
|---|---|
| Change | `prisma7.config.ts`: `DIRECT_DATABASE_URL ?? DATABASE_URL`; `tsconfig.json`: include `prisma7.config.ts`; "account" → "User" in the 7 places under `src` (comments and Swagger descriptions); re-export `openapi.json` |
| Test | No automated test (plan §6). Manual: `dotenv -e .env.test -- prisma migrate status` with `DIRECT_DATABASE_URL` set to the test DB and `DATABASE_URL` to a wrong URL → succeeds. `grep -ri account src` → no match outside generated code. Contract test (S8) green after the re-export |

---

## Verification

### - [ ] P14. Full run, review, docs, PR

| Step | |
|---|---|
| 6 Run | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` |
| 8 Review | Skill `review-against-spec` (diff vs spec, vs RULE.md / GLOSSARY / ADRs); RULE.md §4 and §5 |
| 9 Refactor | All green first; functions ≤ 30 lines; import order |
| Docs | CLAUDE.md M2 checkbox for this branch; RULE.md §1 folder tree (`redis/`, `openapi/`, `scripts/`, `common/throttling/`, `common/logging/`); ADR-0011 versions table; WORKFLOW.md (+ WORKFLOW-VI.md) only if the plan changed |
| 10 PR | Skill `pr`; Evidence includes the hand-checked migration SQL and the `DIRECT_DATABASE_URL` check |
| After | Knowledge summary of the branch (Vietnamese, interview-prep style) |
