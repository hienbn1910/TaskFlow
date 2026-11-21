# Plan — API Production Readiness (Milestone 2, branch `chore/api-production-readiness`)

> Step 2 of the Development Flow (RULE.md §0). Implements [docs/specs/api-production-readiness.md](../specs/api-production-readiness.md).
> First branch built test-first (ADR-0039, skill `tdd`): approving this plan approves the seams in §6.

---

## 1. Dependencies to Add

| Package | Kind | For |
|---|---|---|
| `@nestjs/throttler` (v6) | dependency | Rate limiting (spec §6) |
| `nestjs-pino`, `pino`, `pino-http` | dependency | Logs and request id (spec §7.1–7.2) |
| `pino-pretty` | devDependency | Readable logs in development only |
| `ioredis` | dependency | Redis client for readiness; reused by BullMQ in M6 |

Versions are pinned in `package.json` like the others; ADR-0011's table is updated in the PR.

---

## 2. Data Flow

### 2.1 Request pipeline after this branch

```
request
 → Express: trust proxy (TRUST_PROXY hops) → helmet → Cache-Control: no-store → cookie-parser
 → pino-http: requestId = incoming X-Request-Id if UUID, else new UUID; header X-Request-Id set
 → global guards, in this order (both registered in AuthModule, see §3.3):
     1. JwtAuthGuard        sets request.user (or @Public)
     2. AppThrottlerGuard   keys by user id if request.user, else by IP
 → route guards: OriginGuard on /auth/refresh and /auth/logout
 → ZodValidationPipe → controller → service → repository
 → ZodSerializerInterceptor → ResponseInterceptor
 → on error: GlobalExceptionFilter → standard body + requestId; logged by pino
 → pino-http: one log line (method, route, status, responseTime, requestId, userId)
```

### 2.2 Readiness

```
GET /health/ready
 → HealthController.ready()
 → HealthService.ready(): runs both checks in parallel, each wrapped in withTimeout(…, 3000)
     ├ HealthRepository.pingDatabase()  → prisma.$queryRaw`SELECT 1`
     └ RedisHealthIndicator: client.ping()  (REDIS_CLIENT from RedisModule)
 → all up   → { status: 'ok', checks: { database: 'up', redis: 'up' } }
 → any down → ServiceUnavailableException with details → filter → 503 standard body
```

`SELECT 1` is raw SQL in a repository, the only way Prisma can express "is the database reachable" (RULE.md §3 Raw SQL; no `workspaceId` because nothing is tenant data).

No domain events are published or consumed in this branch.

---

## 3. Design Choices Inside the Spec

### 3.1 Throttler: named throttlers

`@nestjs/throttler` v6 supports several named throttlers, each with its own limit, key (`getTracker`) and skip rule. One custom guard `AppThrottlerGuard` extends `ThrottlerGuard`.

| Throttler | Default limit | Key | Applies when |
|---|---|---|---|
| `anonymous` | 60 / min | IP | no `request.user` |
| `user` | 120 / min | User id | `request.user` set |
| `credentials` | 5 / min | IP + normalized email | only on routes marked by a decorator (login) |

Route overrides with `@Throttle({ … })`:

| Route | Override |
|---|---|
| `POST /auth/login` | `anonymous` → 20 / min; `credentials` enabled (5 / min) |
| `POST /auth/register` | `anonymous` → 5 / hour |
| `POST /auth/refresh` | `anonymous` → 30 / min |
| `PATCH /users/password` | `user` → 5 / 15 min |
| `GET /health`, `GET /health/ready` | `@SkipThrottle()` |

- The normalized email comes from a pure function `credentialsKey(ip, body)` that reuses `emailSchema` (`safeParse`); invalid body → `undefined` → the `credentials` throttler is skipped.
- `errorMessage: 'Too many requests'`. `Retry-After`: v6 sets it per throttler (`Retry-After-<name>` for named throttlers). If the plain `Retry-After` header is not sent, `AppThrottlerGuard.throwThrottlingException` sets it. Confirmed in the first red test of the slice.

### 3.2 Request id

- `nestjs-pino` option `genReqId` = pure function `resolveRequestId(header)`: returns the header if it is a UUID, else `randomUUID()`; also sets the `X-Request-Id` response header.
- `GlobalExceptionFilter` reads `request.id` and adds `requestId` to the body. `ApiErrorResponse` gains `requestId: string`.
- `pino-http` `customProps` adds `userId` from `request.user` when present.

### 3.3 Guard order

`JwtAuthGuard` is an `APP_GUARD` in `AuthModule`. Nest keeps the declaration order of `APP_GUARD` providers **inside one module**, but the order between modules is not something to rely on. So `AppThrottlerGuard` is registered in `AuthModule` right after `JwtAuthGuard`, with a comment, and `ThrottlerModule.forRootAsync` is imported in `AppModule` (global). The test "6th `PATCH /users/password` → 429" proves the order: it can only pass if the User is known when the throttler runs.

### 3.4 Redis client

- New `src/redis/` (`redis.module.ts`, `redis.constants.ts`), same role as `src/prisma/`: one global provider `REDIS_CLIENT` (`ioredis`), `lazyConnect: true`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`; `quit()` on module destroy (no open handle in Jest).
- RULE.md §1 folder tree gains `redis/` in the PR.

### 3.5 OpenAPI export

- `buildOpenApiDocument(app)` moves out of `setupSwagger` into `src/openapi/openapi-document.ts`; Swagger, the export script and the contract test all use it.
- `serializeOpenApi(doc)` = `JSON.stringify(doc, null, 2) + '\n'` (pure).
- Script `src/scripts/export-openapi.ts`: `NestFactory.create(AppModule, { logger: false })` without `init()` (no database or Redis connection), writes `openapi.json`, closes the app.
  `package.json`: `"openapi:export": "nest build && dotenv -e .env -- node dist/scripts/export-openapi.js"`.
- New root `.prettierignore` with `apps/api/openapi.json`, so `pnpm format` never rewrites it.

### 3.6 `prisma7.config.ts`
`url: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL']`. Also fixes `tsconfig.json`, which includes `prisma.config.ts` (old name) instead of `prisma7.config.ts`, so the file is type-checked.

### 3.7 Throttler storage in tests
`test/utils/throttler.ts`: `ResettableThrottlerStorage` wraps the **real** `ThrottlerStorageService` and can swap it for a fresh one; `createTestApp` provides it under the storage token. `resetThrottler(app)` is called in `beforeEach` of the E2E files that send HTTP requests, next to `resetDb`. No env switch (spec §6.3).
*Changed in P7:* clearing the public `storage` map does not reset the counters (the library counts hits in a private map), so the first approach did not work.

### 3.8 Redis down in a test
`createTestApp` accepts an optional override: the readiness test replaces `REDIS_CLIENT` with a **real** `ioredis` client pointed at an unused port. Not a mock: it is the same client, failing for the real reason (connection refused).

---

## 4. Files

### 4.1 New
| File | Purpose |
|---|---|
| `prisma/migrations/<ts>_schema_conventions/migration.sql` | Generated, then edited by hand: `USING … AT TIME ZONE 'UTC'`, `VARCHAR(254)`, partial unique index |
| `src/common/guards/origin.guard.ts` | `Origin` must equal `FRONTEND_URL`, else 403 |
| `src/common/guards/app-throttler.guard.ts` | Named-throttler keys, `Retry-After` |
| `src/common/throttling/throttle.constants.ts` | Limits table (spec §6.1) in one place |
| `src/common/throttling/credentials-key.ts` | Pure: IP + normalized email |
| `src/common/logging/logger.options.ts` | Pure: pino options by environment (level, transport, redact) |
| `src/common/logging/request-id.ts` | Pure: `resolveRequestId(header)` |
| `src/common/utils/with-timeout.util.ts` | Pure: reject after `ms` |
| `src/redis/redis.module.ts`, `src/redis/redis.constants.ts` | `REDIS_CLIENT` |
| `src/modules/health/health.repository.ts` | `pingDatabase()` |
| `src/modules/health/dto/readiness-response.dto.ts` | `{ status, checks }` |
| `src/openapi/openapi-document.ts` | `buildOpenApiDocument`, `serializeOpenApi` |
| `src/scripts/export-openapi.ts` | Writes `openapi.json` |
| `apps/api/openapi.json` | Generated contract, committed |
| `.prettierignore` | Excludes `openapi.json` |
| `test/utils/throttler.ts` | `resetThrottler(app)` |

### 4.2 Modified
| File | Change |
|---|---|
| `prisma/schema.prisma` | `previewFeatures = ["partialIndexes"]`; `@db.Timestamptz(3)` on 6 fields; `email @db.VarChar(254)`; `@@unique([email], where: { deletedAt: null })` |
| `prisma7.config.ts`, `tsconfig.json` | §3.6 |
| `src/modules/users/users.repository.ts` | `findFirst` + `deletedAt: null` for the two email lookups |
| `src/common/cookies/refresh-cookie.ts` | `sameSite: 'lax'` always |
| `src/config/app.config.ts` | `TRUST_PROXY`, `LOG_LEVEL` |
| `src/setup-app.ts` | trust proxy, `no-store`, `useLogger`, Swagger via `buildOpenApiDocument` |
| `src/main.ts` | `bufferLogs: true` so startup logs go through pino |
| `src/app.module.ts` | `LoggerModule`, `ThrottlerModule`, `RedisModule` |
| `src/modules/auth/auth.module.ts` | `AppThrottlerGuard` after `JwtAuthGuard` |
| `src/modules/auth/auth.controller.ts` | `OriginGuard`, `@Throttle` on login / register / refresh, wording |
| `src/modules/users/users.controller.ts` | `@Throttle` on password |
| `src/modules/health/*` | `/ready`, `@SkipThrottle`, `HealthModule` provides the repository |
| `src/common/filters/global-exception.filter.ts` | `requestId` in body; pino logger |
| `src/common/types/api-response.type.ts` | `requestId` |
| `test/utils/auth-helpers.ts` | `createTestApp(overrides?)`; `errorBodySchema` gains `requestId`; requests to cookie routes send `Origin` |
| `test/*.e2e-spec.ts` | `resetThrottler` in `beforeEach` |
| `.env.example`, `.env.test` (local, not committed) | `DIRECT_DATABASE_URL`, `TRUST_PROXY`, `LOG_LEVEL=silent` |
| 7 comments / Swagger texts | "account" → "User" |
| RULE.md §1 | `redis/`, `openapi/`, `scripts/`, `common/throttling/`, `common/logging/` |

---

## 5. Order of Work (detail in `docs/tasks/`)

Infrastructure that every later test depends on comes first:

1. Migration + repository lookups (2.1) — every other test runs on the new schema.
2. Request id + error body (2.6) — later error assertions include `requestId`.
3. Cookie `Lax` + Origin guard (2.3).
4. `no-store` + `TRUST_PROXY` (2.4).
5. Rate limiting (2.5) — needs `TRUST_PROXY` for the spoofing test.
6. Logs: pino options, redact (2.6).
7. Redis module + readiness (2.7).
8. OpenAPI export + contract test (2.8) — last, so the committed file includes every other change.
9. `DIRECT_DATABASE_URL` (2.2) and wording (2.9b).

---

## 6. Seams Under Test

| # | Seam | Kind | Catches | Misses |
|---|---|---|---|---|
| S1 | `POST /auth/register`, `/auth/login` (`test/auth.e2e-spec.ts`) | HTTP endpoint | Email reusable after soft delete, 409 on a live duplicate, concurrent registrations (one 201, one 409), login finds the live User | Index definition itself (S2) |
| S2 | Schema conventions (`test/schema-conventions.repository.e2e-spec.ts`) | Repository guarantee | No `timestamp without time zone` column in `public` (also for every future table); an instant round-trips with the same `getTime()` | Whether the hand-edited `USING` clause converted old rows correctly (reviewed by hand; dev data only, production has no rows yet) |
| S3 | `POST /auth/refresh`, `/auth/logout` with `Origin` (`test/auth.e2e-spec.ts`) | HTTP endpoint | 403 for a wrong or missing Origin, session untouched; `SameSite=Lax` in `Set-Cookie` | Real browser cookie handling through Vercel (deploy branch) |
| S4 | Any route, response headers (`test/http-hardening.e2e-spec.ts`) | HTTP endpoint | `Cache-Control: no-store` on 200 / 4xx / unknown route; `X-Request-Id` generated, echoed when UUID, replaced otherwise; `requestId` in error bodies equals the header | Log output |
| S5 | Rate limits (`test/rate-limit.e2e-spec.ts`) | HTTP endpoint | 6th login (same IP + email, case-insensitive) → 429 + `Retry-After`; 6th register; 6th password change per User (proves guard order); `/health` never limited; a fake `X-Forwarded-For` does not reset the IP counter when `TRUST_PROXY=0` | Behaviour of the real proxy chain (deploy branch); the 120 / 60 per min general limits beyond one check |
| S6 | `GET /health/ready` (`test/health.e2e-spec.ts`) | HTTP endpoint | 200 with both checks up; 503 with a `redis` detail when Redis refuses connections | Database-down path (covered by S7 unit) |
| S7 | Pure logic (`src/**/__tests__/*.spec.ts`) | Unit | `resolveRequestId`, `credentialsKey`, `withTimeout` (fake timers), `appEnvSchema` (`TRUST_PROXY`, `LOG_LEVEL`), `serializeOpenApi`, pino options: a log line written through them contains no password, cookie or `authorization` value | Wiring into the app (S4–S6) |
| S8 | OpenAPI contract (`test/openapi.e2e-spec.ts`) | HTTP endpoint level (real app) | Committed `openapi.json` out of date with the code | Breaking changes for the frontend (seen in the PR diff) |

**Not tested automatically, verified by hand (written in the PR "Evidence"):**
- `prisma7.config.ts` picks `DIRECT_DATABASE_URL` (run `migrate status` with it pointing at the test database). A wiring line, no logic.
- The migration SQL (`AT TIME ZONE 'UTC'`, partial index) — read before applying, as ADR-0023 and ADR-0036 require.

**Existing M1 tests:** e2e helpers must send `Origin` on cookie routes and expect `requestId` in error bodies; these are interface changes the spec asks for, not broken mocks. M1 unit tests that mock repositories stay unless they break.

---

## 7. Security and Performance Notes

- **Security:** Origin check before any session read; rate limits keyed by trusted IP only (hop count, never `true`); pino `redact` for secrets; no secrets in `requestId` or logs; readiness exposes only `up/down`, never error messages or hosts.
- **Free tier:** `/health` stays dependency-free; `/ready` is never pinged on a schedule (Neon awake budget). Throttler is in memory: no Redis commands. `ioredis` connects lazily: one idle connection, far under Key Value's 50.
- **Performance:** one `SELECT 1` + one `PING` per readiness call; throttler and request id are in-memory work per request.
