# Plan — User Profile (Milestone 1, branch `feature/user-profile`)

> Step 2 of the Development Flow (RULE.md §0). Implements [docs/specs/user-profile.md](../specs/user-profile.md).

---

## 1. The Problem: a Circular Module Dependency

The password endpoint needs three things that currently live in the **auth** module:

| Needed by `PATCH /users/password` | Currently in |
|---|---|
| Strength rule for `newPassword`, rule for `currentPassword` | `modules/auth/dto/auth-fields.schema.ts` |
| `canSignIn(user)` (active + not deleted) | `modules/auth/auth.service.ts` |
| Clearing the refresh cookie | `modules/auth/refresh-cookie.service.ts` (+ `refresh-cookie.ts`) |
| Revoking every session | `modules/auth/refresh-token.repository.ts` |

`AuthModule` already imports `UsersModule`. If `UsersModule` imported `AuthModule` back, the modules would form a cycle, which RULE.md §1 forbids: *"if A needs B and B needs A, extract shared logic to a new module"*.

### Decision

| Need | Solution | Why |
|---|---|---|
| Password / name / email schemas | Move to **`common/types/user-fields.schema.ts`** | RULE.md §1: a schema used by two modules goes to `common/types` (same as `user-response.dto.ts`) |
| `canSignIn` | Move to **`modules/users/user.rules.ts`** | It is a rule about a user. Auth (service + guard) already depends on users, so the arrow keeps pointing auth → users |
| Cookie | Move to **`common/cookies/`**: pure options + `RefreshCookieService` + a small `CookieModule` | It is an HTTP concern shared by two modules. `RefreshCookieService` stops depending on `TokenService`: it reads `jwtConfig` directly for `maxAge` |
| Revoking sessions | **Prisma nested write** in `UsersRepository`: `user.update({ data: { password, refreshTokens: { deleteMany: {} } } })` | One statement, so atomic (Prisma runs nested writes in a transaction). Refresh tokens are children of the user (`onDelete: Cascade`). `UsersModule` never touches `RefreshTokenRepository` |

Resulting dependencies (no cycle):

```
AppModule → AuthModule  → UsersModule → (PrismaModule, global)
                        → CookieModule
          → UsersModule → CookieModule
```

### Alternatives considered

| Alternative | Rejected because |
|---|---|
| Put `PATCH /password` in `AuthController` | WORKFLOW.md places it under `/users`; mixes two features in one module (RULE.md §1) |
| `forwardRef()` between the two modules | Hides the cycle instead of removing it; Nest docs call it a last resort |
| A `SessionsModule` exporting `RefreshTokenRepository` to both | Then the password update and the session deletion are in two repositories, and sharing one transaction between them needs a unit-of-work pattern. The nested write is simpler |
| Domain events ("password changed" → auth deletes sessions) | Loses the single transaction; overkill for one listener |

---

## 2. Data Flow

```
PATCH /users/profile
  JwtAuthGuard → ZodValidationPipe → UsersController.updateProfile(@CurrentUser, dto)
    → UsersService.updateProfile(userId, dto) → UsersRepository.updateProfile → toUserResponse

PATCH /users/password
  JwtAuthGuard → ZodValidationPipe → UsersController.changePassword(@CurrentUser, dto, res)
    → UsersService.changePassword(userId, dto)
        UsersRepository.findCredentialsById → verifyPassword → hashPassword
        → UsersRepository.updatePasswordAndRevokeSessions   (one atomic statement)
    → RefreshCookieService.clear(res) → data: null
```

| Layer | Responsibility |
|---|---|
| `UsersController` | Read body + `@CurrentUser()`, call the service, clear the cookie after a password change |
| `UsersService` | Rules: user still allowed (`canSignIn`), current password correct |
| `UsersRepository` | New: `updateProfile`, `findCredentialsById`, `updatePasswordAndRevokeSessions` |

**"New password must differ"** is checked in the DTO (Zod `refine` comparing two fields of the same body, path `newPassword`), not in the service. It only looks at the input, so it belongs with the other input rules. Effect vs the spec: the 400 has `message: "Validation failed"` and the text in `details[newPassword]`, like every other field error.

---

## 3. Files

### 3.1 Refactor (no behavior change; all existing tests must still pass)

| From | To | Notes |
|---|---|---|
| `modules/auth/dto/auth-fields.schema.ts` | `common/types/user-fields.schema.ts` | Adds `fullNameSchema` (now duplicated in register). Renames `loginPasswordSchema` → `passwordInputSchema` (used for login AND current password) |
| `canSignIn` in `modules/auth/auth.service.ts` | `modules/users/user.rules.ts` | Imports updated in `AuthService`, `JwtAuthGuard` |
| `modules/auth/refresh-cookie.ts` | `common/cookies/refresh-cookie.ts` | Pure functions, unchanged |
| `modules/auth/refresh-cookie.service.ts` | `common/cookies/refresh-cookie.service.ts` | Injects `appConfig` + `jwtConfig` instead of `TokenService` |
| — | `common/cookies/cookie.module.ts` | Provides + exports `RefreshCookieService` |
| `TokenService.refreshMaxAgeMs()` | removed | Its only user was the cookie service |

Tests move with their code (`refresh-cookie.spec.ts` → `common/cookies/__tests__/`; DTO tests updated for the new paths).

### 3.2 New

| File | Content |
|---|---|
| `common/constants/user.constant.ts` | `USER_ERROR.CURRENT_PASSWORD_INCORRECT`, `NEW_PASSWORD_SAME`, `NO_FIELDS` |
| `modules/users/dto/update-profile.dto.ts` | `{ fullName?: fullNameSchema }` + refine "at least one field" |
| `modules/users/dto/change-password.dto.ts` | `{ currentPassword: passwordInputSchema, newPassword: newPasswordSchema }` + refine "must differ" |
| `modules/users/users.service.ts` | `updateProfile(userId, dto)`, `changePassword(userId, dto)` |
| `modules/users/users.controller.ts` | `PATCH profile` (`@ZodResponse(UserResponseDto)`), `PATCH password` (`@HttpCode(200)`, clears cookie) |

### 3.3 Modified

| File | Change |
|---|---|
| `modules/users/users.repository.ts` | + `updateProfile(id, data)`, `findCredentialsById(id)`, `updatePasswordAndRevokeSessions(id, hash)` |
| `modules/users/users.module.ts` | Imports `CookieModule`; adds controller + service |
| `modules/auth/auth.module.ts` | Imports `CookieModule`; drops `RefreshCookieService` from providers |
| `CLAUDE.md` | Milestone checklist; Resolved Decision #17 (module boundaries above) |

### 3.4 Tests

| File | Type |
|---|---|
| `modules/users/__tests__/users.service.spec.ts` | Unit: every branch of both methods |
| `modules/users/__tests__/users.controller.spec.ts` | Unit: cookie cleared after password change; `user.id` passed through |
| `modules/users/__tests__/users-dto.spec.ts` | Unit: empty body, unknown fields stripped, "must differ" |
| `test/users.e2e-spec.ts` | Integration: every acceptance criterion in spec §4 |

---

## 4. Security and Performance Notes

| Point | Handling |
|---|---|
| Edit another user | Impossible: no id in URL/body, always `@CurrentUser().id` |
| Mass assignment | Zod strips unknown fields; repository `updateProfile` takes a typed `{ fullName }` object, never the raw body |
| Old sessions after password change | Deleted in the same statement as the password update |
| Password hash in responses | `updatePasswordAndRevokeSessions` selects nothing back; profile update uses `USER_SELECT` |
| Timing attack on `currentPassword` | Not relevant: the user is already identified, nothing to enumerate |
| Brute force of `currentPassword` with a stolen access token | Rate limiting, hardening branch (Decision #16) |
| Queries | All by primary key `id` |
