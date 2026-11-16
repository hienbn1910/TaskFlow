# Tasks — Auth Module (Milestone 1, branch `feature/auth`)

> Step 3 of the Development Flow (RULE.md §0): Task Decomposition.
> Implements [docs/plans/auth.md](../plans/auth.md) for [docs/specs/auth.md](../specs/auth.md).

**How to use this file:** one task per turn. Tick the box when the task is committed. Paths are relative to `apps/api/`.

**Testing approach:** each code task includes the **unit tests** for the code it adds (RULE.md §0 steps 4–5 done per unit, so a bug is caught where it is written). Repositories have no unit tests: they only wrap Prisma, so they are covered by the **integration tests** in A14, against the real test database.

**Done for every task:** `pnpm lint && pnpm typecheck && pnpm test` pass, functions ≤ 30 lines and ≤ 3 parameters, no `any` / `!` / unjustified `as`.

---

## Dependency Order

```
A1 deps + constants
 ├─ A2 duration + hash utils
 ├─ A3 password util
 └─ A4 shared types + @CurrentUser
     └─ A5 users module (repository)
         ├─ A6 refresh-token repository
         ├─ A7 TokenService
         └─ A8 DTOs
             └─ A9 AuthService: register / login / me
                 └─ A10 AuthService: refresh / logout
                     ├─ A11 JwtAuthGuard
                     └─ A12 refresh cookie + filter
                         └─ A13 controller + module wiring
                             └─ A14 integration tests
                                 └─ A15 full test run + fix
                                     └─ A16 security/perf check, refactor, docs, PR
```

---

## Foundation

### - [x] A1. Install dependencies and add auth constants

| | |
|---|---|
| Commands | `pnpm --filter api add @nestjs/jwt bcryptjs` |
| New file | `src/common/constants/auth.constant.ts` |
| Content | `REFRESH_COOKIE_NAME = 'refresh_token'`, `REFRESH_COOKIE_PATH = '/api/v1/auth'`, `BCRYPT_SALT_ROUNDS = 10`, `MAX_PASSWORD_BYTES = 72`, `JWT_ALGORITHM = 'HS256'`, error messages (`INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `EMAIL_ALREADY_REGISTERED`, `UNAUTHORIZED`) |
| Done when | Packages in `package.json`, app still boots, existing tests pass |

### - [x] A2. `duration.util` and `hash.util`

| | |
|---|---|
| New files | `src/common/utils/duration.util.ts`, `src/common/utils/hash.util.ts` |
| Functions | `parseDurationMs(value: string): number`: `"15m"` → 900000, `"7d"` → 604800000. Throws on an invalid format (config already validates it; this is a second guard). <br> `sha256Hex(value: string): string` using `node:crypto` |
| Tests | `__tests__/duration.util.spec.ts`: s/m/h/d units, invalid input throws. <br> `__tests__/hash.util.spec.ts`: known vector (`sha256("abc")`), same input → same output, 64 hex chars |

### - [ ] A3. `password.util`

| | |
|---|---|
| New file | `src/common/utils/password.util.ts` |
| Functions | `hashPassword(plain)`: bcryptjs, `BCRYPT_SALT_ROUNDS`. <br> `verifyPassword(plain, hash): Promise<boolean>`. <br> `verifyAgainstDummy(plain): Promise<false>`: compares against a fixed, pre-computed bcrypt hash (rounds 10) and always returns `false`. Used by login when the email doesn't exist, so the response takes as long as a real check (spec §3.2) |
| Tests | Hash is not the plain text and starts with `$2`; correct/incorrect password; `verifyAgainstDummy` returns `false`; the dummy hash uses cost 10 (same timing as real hashes) |

### - [ ] A4. Shared auth types and `@CurrentUser()`

| | |
|---|---|
| New files | `src/common/types/auth-user.type.ts`: `AuthUser { readonly id: string; readonly email: string }`. <br> `src/common/types/express.d.ts`: augments Express `Request` with `user?: AuthUser`. <br> `src/common/types/user-response.dto.ts`: `userResponseSchema` (`id`, `email`, `fullName`, `avatarUrl` nullable, `createdAt` ISO string) + `UserResponseDto` via `createZodDto`. <br> `src/common/decorators/current-user.decorator.ts`: returns `request.user`; throws `UnauthorizedException` if missing (route forgot the guard, or is `@Public()`) |
| Tests | `__tests__/current-user.decorator.spec.ts`: returns the user; throws when absent |
| Check | `tsconfig` includes `express.d.ts` (typecheck must see `request.user` typed) |

---

## Data Access

### - [ ] A5. Users module: entity, repository, mapper

| | |
|---|---|
| New files | `src/modules/users/entities/user.entity.ts`: `UserEntity` (id, email, fullName, avatarUrl, isActive, deletedAt, createdAt) and `UserCredentials = UserEntity & { password: string }`. <br> `src/modules/users/users.repository.ts`. <br> `src/modules/users/mappers/user.mapper.ts`: `toUserResponse(user: UserEntity): UserResponseDto` (`createdAt` → ISO string). <br> `src/modules/users/users.module.ts`: provides + exports `UsersRepository` |
| Repository methods | `findActiveByEmail(email)`: `deletedAt: null`. <br> `findByEmailWithPassword(email)`: the only query that selects `password`. <br> `findActiveById(id)`: `deletedAt: null`. <br> `create({ email, password, fullName })`. <br> `updateLastLogin(id)`. <br> All use a shared `USER_SELECT` constant (no `password`), per the "select only needed fields" rule |
| Tests | `__tests__/user.mapper.spec.ts`: output has exactly the DTO fields, no `password`/`deletedAt`/`isActive` |

### - [ ] A6. `RefreshTokenRepository`

| | |
|---|---|
| New file | `src/modules/auth/refresh-token.repository.ts` |
| Types | `NewRefreshToken { userId, tokenHash, expiresAt }` in `src/modules/auth/entities/refresh-token.entity.ts` |
| Methods | `create(data)`. <br> `rotate(oldHash, next: NewRefreshToken): Promise<boolean>`: interactive `$transaction`: `deleteMany({ tokenHash: oldHash })`; if `count === 0` return `false` (nothing written); else `create(next)` and return `true`. <br> `deleteByHash(hash)`: `deleteMany` (no error if missing). <br> `deleteAllForUser(userId)` |
| Note | The `count === 0` check is an atomicity condition of the query, not a business rule. The business decision (reuse → revoke all) stays in the service |

---

## Auth Core

### - [ ] A7. `TokenService`

| | |
|---|---|
| New file | `src/modules/auth/token.service.ts` |
| Injects | `JwtService`, `jwtConfig` |
| Methods | `signAccess(userId)`: payload `{ sub }`, access secret + expiry. <br> `signRefresh(userId)`: payload `{ sub, jti: randomUUID() }`, refresh secret + expiry. <br> `verifyAccess(token): Promise<AccessPayload>` / `verifyRefresh(token): Promise<RefreshPayload>`: `algorithms: ['HS256']`, then parse the payload with a Zod schema (`sub: z.uuid()`, `jti: z.uuid()` for refresh). Any failure → `UnauthorizedException`. <br> `refreshExpiresAt(): Date`: now + `parseDurationMs(refreshExpiry)` |
| Tests | `__tests__/token.service.spec.ts` with a real `JwtService`: sign → verify round trip; two refresh tokens for the same user differ; expired token rejected (fake timers); tampered signature rejected; **access token rejected by `verifyRefresh` and vice versa**; token signed with `alg: none` / HS512 rejected; payload with wrong shape rejected |

### - [ ] A8. Request/response DTOs

| | |
|---|---|
| New files | `src/modules/auth/dto/auth-fields.schema.ts`: `emailSchema` (trim → lowercase → `z.email().max(254)`), `passwordBytesLimit` refine. <br> `dto/register.dto.ts`: email, strong password (min 8, uppercase, digit, ≤ 72 bytes), `fullName` via `sanitizedString(min 1, max 100)`. <br> `dto/login.dto.ts`: email, password (min 1, ≤ 72 bytes, no strength rule). <br> `dto/auth-response.dto.ts`: `{ accessToken, user: userResponseSchema }` |
| Tests | `__tests__/auth-dto.spec.ts`: email normalized; each password rule fails with its own message; 72-byte limit counted in bytes (e.g. a 30-char Vietnamese/emoji string over 72 bytes fails); `fullName` HTML stripped; login accepts a weak password |

### - [ ] A9. `AuthService`: register, login, getProfile

| | |
|---|---|
| New files | `src/modules/auth/auth.service.ts`, `src/modules/auth/entities/auth-session.entity.ts` (`AuthSession { accessToken, refreshToken, user: UserResponseDto }`) |
| Methods | `register(dto)`: duplicate check → 409 → `hashPassword` → `create` → `startSession`. <br> `login(dto)`: find with password → if none: `verifyAgainstDummy` + 401 → if deleted/inactive or wrong password: 401 (same message) → `updateLastLogin` → `startSession`. <br> `getProfile(userId)`: `findActiveById` → 401 if missing or inactive → `toUserResponse`. <br> private `startSession(user)`: sign both tokens → `refreshTokenRepository.create` with `sha256Hex` + `refreshExpiresAt()` → return `AuthSession` |
| Tests | `__tests__/auth.service.spec.ts` (repositories + `TokenService` mocked, password util real or mocked): every branch above; **the 401 for unknown email, wrong password, deleted and inactive user has the identical message**; dummy check runs when the email is unknown; stored value is the hash, not the raw refresh token; returned `user` has no `password` |

### - [ ] A10. `AuthService`: refresh, logout

| | |
|---|---|
| Modified file | `src/modules/auth/auth.service.ts` |
| Methods | `refresh(token: string \| undefined)`: missing → 401 → `verifyRefresh` → `findActiveById` (401 if missing/inactive) → sign new pair → `rotate(sha256Hex(old), next)` → if `false`: `deleteAllForUser(sub)` + 401 (reuse detected, log a warning with the masked user id) → return `AuthSession`. <br> `logout(token: string \| undefined)`: if present, `deleteByHash(sha256Hex(token))`. No signature check, never throws |
| Tests | Added to `auth.service.spec.ts`: happy path calls `rotate` with the old hash; **reuse (`rotate` → `false`) calls `deleteAllForUser` and throws 401**; missing/invalid token → 401 without touching the DB; inactive user → 401; logout with/without token never throws |
| Size check | `refresh` is the longest method: extract `issueRotatedSession` helper if it passes 30 lines |

### - [ ] A11. `JwtAuthGuard`

| | |
|---|---|
| New file | `src/common/guards/jwt-auth.guard.ts` |
| Injects | `Reflector`, `TokenService`, `UsersRepository` |
| Logic | `@Public()` (handler or class, via `getAllAndOverride`) → allow. Else: read `Authorization`, require `Bearer <token>` → `verifyAccess` → `findActiveById` → 401 if missing or `!isActive` → `request.user = { id, email }` → allow |
| Tests | `__tests__/jwt-auth.guard.spec.ts`: public route skips verification; missing header, wrong scheme (`Basic`), empty token → 401; valid token → `request.user` set; deleted/inactive user → 401 |

---

## HTTP Layer

### - [ ] A12. Refresh cookie options and `RefreshCookieFilter`

| | |
|---|---|
| New files | `src/modules/auth/refresh-cookie.ts`: `buildRefreshCookieOptions({ isProduction, maxAgeMs }): CookieOptions` (`httpOnly`, `secure` and `sameSite` by env, `path: REFRESH_COOKIE_PATH`, `maxAge`) and `buildClearCookieOptions(isProduction)` (same without `maxAge`, so the browser actually removes it). <br> `src/modules/auth/filters/refresh-cookie.filter.ts`: `@Catch()`, extends `GlobalExceptionFilter`, injects `appConfig`; `catch()` clears the cookie then calls `super.catch()` |
| Tests | Options in production (`secure: true`, `sameSite: 'none'`) vs development (`false`, `'lax'`); filter clears the cookie and still returns the standard error body |

### - [ ] A13. `AuthController`, `AuthModule`, wiring

| | |
|---|---|
| New files | `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.module.ts` |
| Controller | `@ApiTags('Auth')`, `@Controller('auth')`. <br> `register` (`@Public`, `@HttpCode(201)`), `login` (`@Public`, `@HttpCode(200)`), `refresh` (`@Public`, `@HttpCode(200)`, `@UseFilters(RefreshCookieFilter)`, `@ApiCookieAuth`), `logout` (`@Public`, `@HttpCode(200)`, returns nothing), `me` (`@ApiBearerAuth`, `@CurrentUser()`). <br> `@ZodResponse` on every endpoint that returns data. <br> Uses `@Res({ passthrough: true })` to set/clear the cookie; returns `{ accessToken, user }`, **never** the `AuthSession` object |
| Module | Imports `UsersModule`, `JwtModule.register({})`; provides `AuthService`, `TokenService`, `RefreshTokenRepository`, `RefreshCookieFilter`, `{ provide: APP_GUARD, useClass: JwtAuthGuard }` |
| Modified | `src/app.module.ts`: import `AuthModule` |
| Tests | `__tests__/auth.controller.spec.ts` (service mocked): cookie set with the refresh token on register/login/refresh; body has no `refreshToken`; logout clears the cookie; `me` passes `user.id` |

---

## Verification

### - [ ] A14. Integration tests

| | |
|---|---|
| New files | `test/utils/reset-db.ts` (truncate `refresh_tokens`, `users`), `test/utils/auth-helpers.ts` (`registerUser`, `extractRefreshCookie`), `test/auth.e2e-spec.ts` |
| Setup | `docker compose up -d --wait`, `pnpm --filter api db:migrate:test` |
| Coverage | Every acceptance criterion in spec §6, including: password stored as bcrypt hash in the DB; `Set-Cookie` attributes; old refresh cookie reused → 401 **and** the user's other session (second login) also stops working; refresh after logout → 401; `/health` still public; existing `app.e2e-spec.ts` still passes |

### - [ ] A15. Full test run and fixes (RULE.md §0 steps 6–7)

`pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. Fix failures; rerun the whole suite after every fix.

### - [ ] A16. Security/performance check, refactor, docs, PR (steps 8–10)

| | |
|---|---|
| Check | RULE.md §4 (indexes: `users.email` unique, `refresh_tokens.token_hash` unique, `user_id` indexed: already in schema), §5 (no password/token in responses or logs), function size and parameter limits, import order |
| Docs | `CLAUDE.md`: tick auth tasks in Milestone 1, add Resolved Decision #15 (custom JWT guard, no Passport). Tick all boxes in this file |
| PR | Ready-to-paste title and body for the user |
