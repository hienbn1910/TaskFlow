# Tasks — User Profile (Milestone 1, branch `feature/user-profile`)

> Step 3 of the Development Flow (RULE.md §0): Task Decomposition.
> Implements [docs/plans/user-profile.md](../plans/user-profile.md) for [docs/specs/user-profile.md](../specs/user-profile.md).

**How to use this file:** one task per turn. Tick the box when the task is committed. Paths are relative to `apps/api/`.

**Testing approach:** same as auth. Each code task includes the unit tests for the code it adds; repositories are covered by the integration tests in U8. Refactor tasks (U1–U3) add no behavior: their proof is that **every existing test still passes**, unit AND e2e.

**Done for every task:** `pnpm lint && pnpm typecheck && pnpm test` pass (plus `pnpm test:e2e` for U3, U7, U8, U9), functions ≤ 30 lines and ≤ 3 parameters, no `any` / `!` / unjustified `as`.

---

## Dependency Order

```
Refactor (behavior unchanged)
  U1 shared field schemas → common/types
  U2 canSignIn → users/user.rules.ts
  U3 refresh cookie → common/cookies + CookieModule
Feature
  U4 constants + DTOs
  U5 UsersRepository: new methods
  U6 UsersService
  U7 UsersController + module wiring
Verification
  U8 integration tests
  U9 full run, security/perf check, docs, PR, knowledge summary
```

U1, U2 and U3 are independent of each other; U4 needs U1; U6 needs U2 and U5; U7 needs U3 and U6.

---

## Refactor

### - [x] U1. Move field schemas to `common/types/user-fields.schema.ts`

| | |
|---|---|
| Move | `modules/auth/dto/auth-fields.schema.ts` → `common/types/user-fields.schema.ts` (`git mv`, so history follows) |
| Content | `emailSchema`, `newPasswordSchema` (unchanged). `loginPasswordSchema` renamed **`passwordInputSchema`** (login and current password). **New** `fullNameSchema` = `sanitizedString(z.string().min(1).max(100))`, extracted from `register.dto.ts` |
| Update | `register.dto.ts` (uses `fullNameSchema`), `login.dto.ts` |
| Tests | `auth-dto.spec.ts` unchanged and green: it tests the DTOs, which keep the same behavior |

### - [x] U2. Move `canSignIn` to `modules/users/user.rules.ts`

| | |
|---|---|
| New file | `modules/users/user.rules.ts`: `canSignIn(user: UserEntity): boolean` (moved as-is) |
| Update | `auth.service.ts` (remove the function, import it), `common/guards/jwt-auth.guard.ts` (import from users, not auth) |
| Tests | New `modules/users/__tests__/user.rules.spec.ts`: active ✓, inactive ✗, soft-deleted ✗. Existing AuthService and guard tests unchanged and green |

### - [x] U3. Move the refresh cookie to `common/cookies/` + `CookieModule`

| | |
|---|---|
| Move | `modules/auth/refresh-cookie.ts` → `common/cookies/refresh-cookie.ts`; `modules/auth/refresh-cookie.service.ts` → `common/cookies/refresh-cookie.service.ts` (`git mv`) |
| Change | `RefreshCookieService` injects `jwtConfig` instead of `TokenService`; `maxAge = parseDurationMs(refreshExpiry)` |
| New file | `common/cookies/cookie.module.ts`: provides + exports `RefreshCookieService` |
| Update | `auth.module.ts` (imports `CookieModule`, drops the provider), `auth.controller.ts`, `refresh-cookie.filter.ts` (imports). Remove `TokenService.refreshMaxAgeMs()` and its test |
| Tests | `refresh-cookie.spec.ts` → `common/cookies/__tests__/` (options + service), providers updated (`jwtConfig` instead of `TokenService`). The filter stays in auth, so its tests move to `modules/auth/__tests__/refresh-cookie.filter.spec.ts` (service mocked). **Run e2e too**: cookie attributes are checked there |

---

## Feature

### - [x] U4. Constants and DTOs

| | |
|---|---|
| New files | `common/constants/user.constant.ts`: `USER_ERROR = { CURRENT_PASSWORD_INCORRECT, NEW_PASSWORD_SAME, NO_FIELDS }`. <br> `modules/users/dto/update-profile.dto.ts`: `{ fullName: fullNameSchema.optional() }` + refine: at least one defined field (`NO_FIELDS`). <br> `modules/users/dto/change-password.dto.ts`: `{ currentPassword: passwordInputSchema, newPassword: newPasswordSchema }` + refine on path `newPassword`: different from `currentPassword` (`NEW_PASSWORD_SAME`) |
| Tests | `modules/users/__tests__/users-dto.spec.ts`: `{}` → `NO_FIELDS`; `fullName` cleaned / length limits; unknown fields (`email`, `isActive`, `password`) stripped; weak `newPassword` fails with its rule; same passwords → error on `newPassword`; empty `currentPassword` fails; weak `currentPassword` accepted (no strength rule) |

### - [x] U5. `UsersRepository`: new methods

| | |
|---|---|
| Modified file | `modules/users/users.repository.ts` |
| Methods | `updateProfile(id, data: UpdateProfileData): Promise<UserEntity>`: `update` with `USER_SELECT`. `UpdateProfileData` is a typed entity (`{ fullName?: string }`), never the raw body. <br> `findCredentialsById(id): Promise<UserCredentials \| null>`: `deletedAt: null`, `CREDENTIALS_SELECT`. <br> `updatePasswordAndRevokeSessions(id, passwordHash): Promise<void>`: **one** `user.update` with `data: { password, refreshTokens: { deleteMany: {} } }`, `select: { id: true }` |
| Note | Both updates also filter `deletedAt: null` (a user soft-deleted meanwhile → P2025 → 404, nothing written) |
| Tests | `test/users.repository.e2e-spec.ts` (real DB, like `refresh-token.repository.e2e-spec.ts`): new hash stored AND all sessions gone; **another user's sessions untouched** (`deleteMany: {}` is scoped to the user); soft-deleted user → nothing changed. HTTP-level coverage in U8 |

### - [x] U6. `UsersService`

| | |
|---|---|
| New file | `modules/users/users.service.ts` |
| Methods | `updateProfile(userId, dto)`: `updateProfile` → `toUserResponse`. <br> `changePassword(userId, dto)`: `findCredentialsById` → null or `!canSignIn` → 401 → `verifyPassword(current)` false → **400** `CURRENT_PASSWORD_INCORRECT` → `hashPassword(new)` → `updatePasswordAndRevokeSessions` |
| Tests | `modules/users/__tests__/users.service.spec.ts` (repository mocked, `password.util` mocked as in auth): profile returns the public user; wrong current password → 400 and **nothing written**; correct → hash of the NEW password stored, sessions revoked in the same call; missing/inactive user → 401; the plain new password never reaches the repository |

### - [x] U7. `UsersController` and module wiring

| | |
|---|---|
| New file | `modules/users/users.controller.ts`: `@ApiTags('Users')`, `@ApiBearerAuth()`, `@Controller('users')`. <br> `PATCH profile`: `@ZodResponse({ status: 200, type: UserResponseDto })`. <br> `PATCH password`: `@HttpCode(200)`, `@Res({ passthrough: true })`, calls the service then `cookies.clear(res)`; returns nothing (`data: null`) |
| Modified | `users.module.ts`: imports `CookieModule`; adds `UsersController`, `UsersService` |
| Tests | `modules/users/__tests__/users.controller.spec.ts`: passes `user.id` from `@CurrentUser()`; cookie cleared **after** a successful change and **not** when the service throws. `test/app.e2e-spec.ts`: Swagger document contains `/api/v1/users/profile` and `/api/v1/users/password` |

---

## Verification

### - [x] U8. Integration tests

| | |
|---|---|
| New file | `test/users.e2e-spec.ts` (reuses `test/utils/auth-helpers.ts`, `reset-db.ts`; adds `patchProfile` / `changePassword` helpers if useful) |
| Coverage | Every acceptance criterion in spec §4, including: new name visible through `GET /auth/me`; extra fields don't change email / status / password in the DB; after a password change, **two devices' refresh cookies both fail** and the DB has 0 sessions; old password → 401 at login, new → 200; wrong current password → 400, password hash unchanged, sessions still there; the response clears the refresh cookie; no token → 401 on both endpoints |

### - [ ] U9. Full run, security/perf check, docs, PR, knowledge summary

| | |
|---|---|
| Run | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` |
| Check | RULE.md §4 / §5 as in auth A16: no `any` / `as` / `!` in `src/`, no secrets in logs, only primary-key queries |
| Docs | `CLAUDE.md`: tick "Users module" and "Unit tests + integration tests" in Milestone 1; Resolved Decision #17 (module boundaries: shared schemas in `common/types`, cookie in `common/cookies`, `canSignIn` in users, sessions revoked by nested write). `README.md`: Milestone 1 status. Tick all boxes in this file |
| PR | Ready-to-paste title and body |
| Notes | Knowledge summary → `notes/feature-user-profile.md` (local, not committed) |
