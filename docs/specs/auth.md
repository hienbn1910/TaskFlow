# Spec — Auth Module (Milestone 1, branch `feature/auth`)

> Step 1 of the Development Flow (RULE.md §0).
> Sources: WORKFLOW.md §5 (Auth Module endpoints), §6 Feature 1 (Authentication), RULE.md §5,
> CLAUDE.md Resolved Decisions #1, #4, #5, #6, #7, #13.

---

## 1. Scope

### In scope

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Create an account, start a session |
| POST | `/api/v1/auth/login` | Public | Start a session |
| POST | `/api/v1/auth/refresh` | Public (needs refresh cookie) | Rotate the refresh token, issue a new access token |
| POST | `/api/v1/auth/logout` | Public (needs refresh cookie) | End the current session |
| GET | `/api/v1/auth/me` | Authenticated | Return the current user's profile |

Plus the infrastructure these endpoints need:

- **JWT access strategy + global `JwtAuthGuard`** (`APP_GUARD`). Every endpoint requires an access token unless it has `@Public()`. Health and Swagger stay public.
- **`@CurrentUser()` decorator** to read the authenticated user in controllers.

### Out of scope (deferred)

| Item | Reason | Planned for |
|---|---|---|
| `POST /forgot-password`, `POST /reset-password` | Need email sending through a queue | Milestone 5 (Bull/BullMQ) |
| Cleanup job for expired `refresh_tokens` rows | Background job | Milestone 5 |
| Rate limiting on `login` / `register` | Not required by RULE.md; recommended | Separate hardening branch (proposal: `@nestjs/throttler`) |
| Profile / password change | Users module | `feature/user-profile` |
| Email verification | Not in WORKFLOW.md | — |

### Database

Tables: `users`, `refresh_tokens`. **No schema change needed**. The current `schema.prisma` already has `users.deletedAt`, `users.lastLoginAt`, `refresh_tokens.tokenHash` (unique) and `refresh_tokens.expiresAt`.

Auth tables are not tenant-scoped (no `workspaceId`). This is expected: users exist before they join any workspace.

---

## 2. Shared Definitions

### 2.1 Input rules

| Field | Rule |
|---|---|
| `email` | Valid email, trimmed, **lowercased** before any lookup or insert. Max 254 chars |
| `password` (register) | Min 8 chars, at least 1 uppercase letter and 1 digit. **Max 72 bytes (UTF-8)**, because bcrypt ignores bytes after 72 |
| `password` (login) | Non-empty string, max 72 bytes. The strength rule is NOT checked at login, so the error doesn't reveal the password policy for existing accounts |
| `fullName` | Trimmed, HTML stripped (existing `sanitize.util`), 1–100 chars (matches `VarChar(100)`) |

Unknown fields in the body are rejected or stripped by the Zod schema. `password` is never trimmed.

### 2.2 `UserResponseDto` (returned by register, login, me)

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "Nguyen Van A",
  "avatarUrl": null,
  "createdAt": "2026-11-16T10:00:00.000Z"
}
```

Never included: `password`, `deletedAt`, `isActive`, `updatedAt`, any refresh token data. Enforced twice: by the mapper and by `@ZodResponse` (Decision #13).

### 2.3 `AuthResponseDto` (returned by register, login, refresh)

```json
{
  "accessToken": "eyJ...",
  "user": { /* UserResponseDto */ }
}
```

The refresh token is **never** in the body (Decision #5). It is sent only as a cookie.

### 2.4 Tokens

| | Access token | Refresh token |
|---|---|---|
| Secret | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` (must differ, already validated in `jwt.config.ts`) |
| Expiry | `JWT_ACCESS_EXPIRY` (15m) | `JWT_REFRESH_EXPIRY` (7d) |
| Payload | `{ sub: userId }` | `{ sub: userId, jti: randomUUID() }` |
| Transport | `Authorization: Bearer <token>` | httpOnly cookie |
| Stored in DB | No | `sha256(token)` in `refresh_tokens.tokenHash`, with `expiresAt` |

`jti` makes every refresh token unique. Without it, two logins by the same user in the same second would produce identical JWTs and break the unique constraint on `tokenHash`.

### 2.5 Refresh cookie

| Attribute | Value |
|---|---|
| Name | `refresh_token` |
| `httpOnly` | `true` |
| `secure` | `true` in production, `false` in development/test (plain HTTP on localhost) |
| `sameSite` | `none` in production, `lax` in development/test |
| `path` | `/api/v1/auth` (the cookie is not sent to any other endpoint) |
| `maxAge` | Same as `JWT_REFRESH_EXPIRY` |

**Assumption:** `sameSite=none` in production because the web app (Vercel) and the API (Render) are on different sites, and the browser would not send a `lax`/`strict` cookie on cross-site `fetch`. This requires CORS with `credentials: true` and an explicit origin allowlist (never `*`).

### 2.6 Session

One session = one row in `refresh_tokens`. A user can have several sessions at once (several devices/browsers).

---

## 3. Endpoints

### 3.1 POST `/auth/register`

**Input (body):** `{ email, password, fullName }`

**Flow:**
1. Validate input (§2.1). Normalize email.
2. If an **active** user (`deletedAt` is null) with this email exists → `409 CONFLICT`, message `"Email already registered"`.
3. Hash password with bcryptjs, 10 salt rounds (Decision #6).
4. Create the user.
5. Start a session (§4.1).
6. Return `201` with `AuthResponseDto` and set the refresh cookie.

**Errors:**

| Case | Status | Message |
|---|---|---|
| Invalid input | 400 | Validation details per field |
| Email already used | 409 | `Email already registered` |
| Two concurrent registrations with the same email | 409 | Same as above. The DB unique constraint (P2002) is the final guard; the global filter already maps P2002 to 409 |

**Note:** `users.email` is `@unique` for all rows, including soft-deleted ones. A soft-deleted user's email therefore cannot be reused for now (also returns 409). Reuse of deleted emails is out of scope.

**Note:** Returning 409 reveals that an email is registered. This is accepted for register (the standard trade-off). Login must not reveal it (§3.2).

### 3.2 POST `/auth/login`

**Input (body):** `{ email, password }`

**Flow:**
1. Validate input. Normalize email.
2. Find the user by email.
3. If the user does not exist, is soft-deleted, or `isActive = false` → `401`.
4. Compare the password with bcrypt. No match → `401`.
5. Update `lastLoginAt = now()`.
6. Start a session (§4.1).
7. Return `200` with `AuthResponseDto` and set the refresh cookie.

**Errors:** every failure in steps 2–4 returns the **same** response: `401`, message `"Invalid credentials"` (WORKFLOW.md: prevent email enumeration).

**Timing:** when the user is not found, still run one bcrypt comparison against a fixed dummy hash. Otherwise "unknown email" answers much faster than "wrong password", and the response time would reveal which emails exist.

### 3.3 POST `/auth/refresh`

**Input:** the `refresh_token` cookie. No body.

**Flow:**
1. No cookie → `401`.
2. Verify the JWT with `JWT_REFRESH_SECRET`. Invalid signature, malformed or expired → `401`, clear the cookie.
3. Compute `sha256(token)` and delete the matching row **atomically** (`deleteMany` by `tokenHash`, check the deleted count).
4. **Deleted count = 0 → reuse detected.** The JWT is valid but the session no longer exists: the token was already rotated (or logged out) and someone is using it again. Delete **all** refresh tokens of `sub` (revoke every session of that user, Decision #5) → `401`, clear the cookie.
5. Load the user. Not found, soft-deleted or inactive → `401`, clear the cookie.
6. Start a new session (§4.1).
7. Return `200` with `AuthResponseDto` and set the new refresh cookie.

Steps 3 and 6 run in one transaction, so a failure cannot leave the user with no valid session and no new token.

**Why atomic delete instead of find-then-delete:** two parallel requests with the same token would both pass a "find" check and both get a new session. With `deleteMany` + count, only one request can win.

**Known limitation:** if the frontend sends two refresh requests at the same moment with the same cookie (e.g. two tabs), the second one is treated as reuse and logs the user out everywhere. The frontend must make sure only one refresh request runs at a time (single-flight). This will be handled in the web app milestone.

**Errors:** all cases → `401`, message `"Invalid refresh token"`.

### 3.4 POST `/auth/logout`

**Input:** the `refresh_token` cookie. No body.

**Access:** `@Public()`. Logout must work even when the access token has already expired.

**Flow:**
1. If a cookie is present, delete the row with `tokenHash = sha256(cookie)`. A missing row is not an error. The JWT signature is not checked (deleting by hash is harmless).
2. Always clear the cookie.
3. Return `200` with `data: null`.

**Idempotent:** calling logout twice, or with no cookie, still returns `200`.

**Effect on reuse detection:** after logout, if the same (still unexpired) refresh token is sent to `/refresh`, it hits step 4 of §3.3 and revokes all sessions of that user. This is intended: a logged-out token should never be used again, so its use is suspicious.

### 3.5 GET `/auth/me`

**Input:** `Authorization: Bearer <accessToken>`.

**Flow:**
1. `JwtAuthGuard` verifies the access token (§4.2).
2. Load the user by `sub`.
3. Return `200` with `UserResponseDto`.

**Errors:**

| Case | Status |
|---|---|
| Missing, malformed or expired access token | 401 |
| User soft-deleted or inactive since the token was issued | 401 |

---

## 4. Internal Behavior

### 4.1 Start a session

Used by register, login and refresh.

1. Sign the access token and the refresh token (§2.4).
2. Insert `refresh_tokens { userId, tokenHash: sha256(refreshToken), expiresAt: now + refresh expiry }`.
3. Return both tokens to the controller. The controller puts the refresh token in the cookie and the access token in the body.

### 4.2 JWT access strategy / global guard

- Registered as `APP_GUARD`, so it runs on every route.
- Routes with `@Public()` (existing decorator) skip it.
- Reads `Authorization: Bearer`, verifies with `JWT_ACCESS_SECRET`.
- Loads the user by `sub`. Rejects soft-deleted or inactive users with `401`. This costs one query per request; accepted for now (a Redis cache can be added later if needed).
- Attaches `{ id, email }` to the request for `@CurrentUser()`.

### 4.3 Logging

- Never log passwords, password hashes, or full tokens.
- Emails and tokens in logs are masked with the existing `mask.util` (RULE.md §5).

---

## 5. Response Format

All responses use the standard format (WORKFLOW.md §5, Decision #1):

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "statusCode": 401, "error": "UNAUTHORIZED", "message": "Invalid credentials" }
```

---

## 6. Acceptance Criteria

**Register**
- [ ] Valid input → 201, body has `accessToken` + `user`, `Set-Cookie` has `refresh_token` with `HttpOnly` and `Path=/api/v1/auth`.
- [ ] Response body never contains `password` or a refresh token.
- [ ] Password is stored as a bcrypt hash, never in plain text.
- [ ] `User@Example.COM` and `user@example.com` are treated as the same email.
- [ ] Duplicate email → 409.
- [ ] Weak password (no uppercase / no digit / < 8 chars / > 72 bytes) → 400 with field details.
- [ ] `fullName` with HTML tags is stored without the tags.

**Login**
- [ ] Correct credentials → 200, tokens issued, `lastLoginAt` updated.
- [ ] Wrong password, unknown email, soft-deleted user and inactive user all return the identical 401 `"Invalid credentials"`.

**Refresh**
- [ ] Valid cookie → 200, new access token, new cookie; the old token row no longer exists.
- [ ] Using the old (rotated) cookie again → 401, and **all** sessions of that user are revoked.
- [ ] Missing / expired / tampered cookie → 401.
- [ ] A refresh token signed with the access secret is rejected (and vice versa).

**Logout**
- [ ] With a valid cookie → 200, the session row is deleted, the cookie is cleared.
- [ ] Without a cookie, or called twice → still 200.
- [ ] After logout, `/refresh` with the old cookie → 401.

**Me & Guard**
- [ ] Valid access token → 200 with `UserResponseDto`.
- [ ] No token / expired token / refresh token used as access token → 401.
- [ ] Endpoints without `@Public()` require a token; `/health` and `/api/docs` stay public.

**Quality (RULE.md)**
- [ ] Unit tests for every service method, integration tests for every endpoint (happy path + errors), run against the test database.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.
