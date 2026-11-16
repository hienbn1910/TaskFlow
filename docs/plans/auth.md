# Plan — Auth Module (Milestone 1, branch `feature/auth`)

> Step 2 of the Development Flow (RULE.md §0). Implements [docs/specs/auth.md](../specs/auth.md).

---

## 1. What already exists (reuse, don't rebuild)

| Existing | Used for |
|---|---|
| `jwtConfig` (`config/jwt.config.ts`) | Secrets and expiries (`accessSecret`, `refreshSecret`, `accessExpiry`, `refreshExpiry`) |
| `appConfig.isProduction` | Cookie `secure` / `sameSite` |
| `setupApp()`: `cookieParser()`, CORS `credentials: true` + `FRONTEND_URL` | Reading the refresh cookie, cross-site cookies. No change needed |
| Swagger `.addBearerAuth()` + `.addCookieAuth('refresh_token')` | Documenting auth on endpoints |
| `@Public()` + `IS_PUBLIC_KEY` | Global guard skips public routes |
| `sanitizedString()` | `fullName` (strip HTML + trim) |
| `mask.util` | Masking emails/tokens in logs |
| `GlobalExceptionFilter` | Error format; P2002 → 409 already handled |
| `ResponseInterceptor` + `ZodSerializerInterceptor` | `{ success, data }` envelope; `data: null` when a handler returns nothing |
| `PrismaModule` (global) | Repositories inject `PrismaService` |

---

## 2. Data Flow

```
HTTP → [JwtAuthGuard (global)] → [ZodValidationPipe] → AuthController
         → AuthService ──→ UsersRepository          → Prisma (users)
                      ├─→ RefreshTokenRepository   → Prisma (refresh_tokens)
                      ├─→ TokenService             → @nestjs/jwt
                      └─→ password.util / hash.util
       ← AuthSession { accessToken, refreshToken, user }
AuthController: refresh token → cookie, { accessToken, user } → body
       → ZodSerializerInterceptor (strip unknown fields) → ResponseInterceptor (envelope)
```

**Who does what:**

| Layer | Responsibility |
|---|---|
| `AuthController` | Read body/cookie, call the service, put the refresh token in the cookie, return `{ accessToken, user }`. No `if` on business rules |
| `AuthService` | All rules: duplicate email, credential check, reuse detection, user active check, mapping to DTOs |
| `TokenService` | Sign/verify JWTs, compute `expiresAt`. No DB access |
| `UsersRepository` | Queries on `users`, with `select` (never fetches `password` unless asked) |
| `RefreshTokenRepository` | Queries on `refresh_tokens`, including the atomic rotation transaction |

### Per endpoint

**register:** controller → `authService.register(dto)` → `usersRepository.findActiveByEmail` (409 if found) → `hashPassword` → `usersRepository.create` → `startSession(user)` → controller sets cookie.

**login:** controller → `authService.login(dto)` → `usersRepository.findByEmailWithPassword` → `verifyPassword` (dummy hash if no user) → reject deleted/inactive → `usersRepository.updateLastLogin` → `startSession(user)`.

**refresh:** controller reads `req.cookies.refresh_token` → `authService.refresh(token)` → `tokenService.verifyRefresh` → `usersRepository.findActiveById` → sign new pair → `refreshTokenRepository.rotate(oldHash, newRecord)` → if `false`: `refreshTokenRepository.deleteAllForUser` + 401.

**logout:** controller reads cookie → `authService.logout(token)` → `refreshTokenRepository.deleteByHash` → controller clears cookie → returns nothing (`data: null`).

**me:** guard attaches `AuthUser` → controller → `authService.getProfile(user.id)` → `usersRepository.findActiveById`.

### Clearing the cookie when refresh fails

`/refresh` must clear the cookie on every 401 (spec §3.3). A thrown exception skips the rest of the controller, so the controller can't do it without a try/catch (which would be logic in the controller). Solution: **`RefreshCookieFilter`**, applied only on `/refresh` with `@UseFilters`. It extends `GlobalExceptionFilter`: clears the cookie, then calls `super.catch()` so the error format stays identical.

---

## 3. Files

### 3.1 New files

**`common/` (shared, no dependency on feature modules except the guard's injected repository)**

| File | Content |
|---|---|
| `common/guards/jwt-auth.guard.ts` | Global guard: skip if `@Public()`, verify Bearer token, load active user, set `req.user` |
| `common/decorators/current-user.decorator.ts` | `@CurrentUser()` → `AuthUser` from `req.user` |
| `common/types/auth-user.type.ts` | `AuthUser { id, email }` |
| `common/types/express.d.ts` | Adds `user?: AuthUser` to Express `Request` (no `as` casts needed) |
| `common/types/user-response.dto.ts` | `userResponseSchema` + `UserResponseDto`. In `common/types` because auth (now) and users (next branch) both return it (RULE.md §1) |
| `common/utils/duration.util.ts` | `parseDurationMs('7d')` → ms. For `expiresAt` and cookie `maxAge` |
| `common/utils/hash.util.ts` | `sha256Hex(value)` |
| `common/utils/password.util.ts` | `hashPassword`, `verifyPassword`, `verifyAgainstDummy` (bcryptjs, 10 rounds, fixed dummy hash) |
| `common/constants/auth.constant.ts` | `REFRESH_COOKIE_NAME`, `REFRESH_COOKIE_PATH`, `BCRYPT_SALT_ROUNDS`, error messages |

**`modules/users/` (only the parts auth needs; profile endpoints come in `feature/user-profile`)**

| File | Content |
|---|---|
| `users.module.ts` | Provides and exports `UsersRepository` |
| `users.repository.ts` | `findActiveByEmail`, `findByEmailWithPassword`, `findActiveById`, `create`, `updateLastLogin` |
| `entities/user.entity.ts` | `UserEntity` (no password), `UserCredentials` (entity + password hash). Plain types, not Prisma types |
| `mappers/user.mapper.ts` | `toUserResponse(entity)` → `UserResponseDto` |

**`modules/auth/`**

| File | Content |
|---|---|
| `auth.module.ts` | Imports `UsersModule`, `JwtModule.register({})`. Provides service, repositories, `TokenService`, `RefreshCookieFilter`, and `{ provide: APP_GUARD, useClass: JwtAuthGuard }` |
| `auth.controller.ts` | 5 endpoints, `@ZodResponse` on each, Swagger tags |
| `auth.service.ts` | `register`, `login`, `refresh`, `logout`, `getProfile`, private `startSession` |
| `token.service.ts` | `signAccess`, `signRefresh`, `verifyAccess`, `verifyRefresh` (secrets passed per call, so access and refresh can never be mixed up) |
| `refresh-token.repository.ts` | `create`, `rotate` (transaction: `deleteMany` by hash → if count 0 return `false` → `create` → `true`), `deleteByHash`, `deleteAllForUser` |
| `refresh-cookie.ts` | `buildRefreshCookieOptions(config)`: httpOnly, secure/sameSite by env, path, maxAge |
| `filters/refresh-cookie.filter.ts` | See §2 |
| `entities/auth-session.entity.ts` | `AuthSession { accessToken, refreshToken, user }` (internal, never sent as-is) |
| `dto/register.dto.ts` | `email`, `password` (strength + ≤72 bytes), `fullName` |
| `dto/login.dto.ts` | `email`, `password` (non-empty, ≤72 bytes) |
| `dto/auth-response.dto.ts` | `{ accessToken, user: userResponseSchema }` |

### 3.2 Modified files

| File | Change |
|---|---|
| `app.module.ts` | Import `AuthModule` (and `UsersModule` through it) |
| `apps/api/package.json` | New dependencies (§5) |
| `test/app.e2e-spec.ts` | Check it still passes: `/health` and the echo route are `@Public()`, so the new global guard should not break them |
| `CLAUDE.md` | Milestone checklist + new Resolved Decision(s) at the end of the branch |

### 3.3 Tests

| File | Type |
|---|---|
| `common/utils/__tests__/duration.util.spec.ts`, `hash.util.spec.ts`, `password.util.spec.ts` | Unit |
| `common/guards/__tests__/jwt-auth.guard.spec.ts` | Unit |
| `modules/auth/__tests__/auth.service.spec.ts` | Unit (repositories and TokenService mocked) |
| `modules/auth/__tests__/token.service.spec.ts` | Unit (real `JwtService`) |
| `modules/auth/__tests__/auth.controller.spec.ts` | Unit (cookie set/cleared, body shape) |
| `test/auth.e2e-spec.ts` | Integration against `postgres-test`, covers every acceptance criterion in spec §6 |
| `test/utils/reset-db.ts` | Truncates `users` + `refresh_tokens` between tests |

---

## 4. Zod Schemas and Types

```ts
// dto/register.dto.ts
const MAX_PASSWORD_BYTES = 72;
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const strongPassword = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/\d/, 'Must contain a digit')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_PASSWORD_BYTES, 'Must be at most 72 bytes');
registerSchema = z.object({ email: emailSchema, password: strongPassword,
  fullName: sanitizedString(z.string().min(1).max(100)) });

// common/types/user-response.dto.ts
userResponseSchema = z.object({ id: z.uuid(), email: z.email(), fullName: z.string(),
  avatarUrl: z.string().nullable(), createdAt: z.iso.datetime() });

// dto/auth-response.dto.ts
authResponseSchema = z.object({ accessToken: z.string(), user: userResponseSchema });
```

`emailSchema` and the password byte check are shared by register and login, so they live in one place (`dto/auth-fields.schema.ts`).

**Entity mapping:** the repository returns objects with exactly the `select`ed fields. They are typed as `UserEntity` (our own type). The mapper turns `createdAt: Date` into an ISO string for the response.

---

## 5. Dependencies

| Package | Why |
|---|---|
| `@nestjs/jwt` | Sign/verify JWTs (wrapper over `jsonwebtoken`) |
| `bcryptjs` | Password hashing (Decision #6). v3 ships its own types |

Already installed: `cookie-parser`, `@types/cookie-parser`.

**Not installed: `@nestjs/passport`, `passport`, `passport-jwt`.** See §7, decision needed.

---

## 6. Dependencies Between Modules

```
AppModule → AuthModule → UsersModule → (PrismaModule, global)
                       → JwtModule
```

- `UsersModule` does not import `AuthModule` → no circular dependency.
- `JwtAuthGuard` lives in `common/guards` but is registered as `APP_GUARD` inside `AuthModule`, so Nest resolves its dependencies (`TokenService`, `UsersRepository`) from `AuthModule`.
- Later modules (workspace, channel...) only use `@CurrentUser()` and `@Public()`; they never import `AuthModule`.

---

## 7. Decision Needed: Passport or a custom guard?

WORKFLOW.md §2 lists Passport.js. Proposal: **don't use Passport; write `JwtAuthGuard` directly with `@nestjs/jwt`.**

| | Passport (`@nestjs/passport` + `passport-jwt`) | Custom guard |
|---|---|---|
| Extra packages | 3 | 0 |
| Types | `validate(payload: any)`, needs casts → conflicts with "no `any`, no `as`" | Fully typed with Zod parsing of the payload |
| Code size | Strategy + guard subclass | One guard (~30 lines) |
| Value of Passport | Many strategies (OAuth, Google...) | Not needed: only JWT in this project |

If accepted, record as Resolved Decision #15 in CLAUDE.md.

---

## 8. Risks Checked

| Risk | Handling |
|---|---|
| `password` leaked in a response | `select` without password in every query except `findByEmailWithPassword`; mapper; `@ZodResponse` strips unknown fields |
| Access token used as refresh token (or the reverse) | Different secrets, verified by `TokenService` |
| Parallel refresh with the same token | Atomic `deleteMany` + count inside a transaction |
| Global guard breaks existing routes | `/health` and the e2e echo route already use `@Public()`; Swagger UI is served outside Nest routing |
| Refresh rows piling up | Accepted for now, cleanup job in Milestone 5 |
