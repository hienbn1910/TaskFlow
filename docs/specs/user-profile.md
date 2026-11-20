# Spec — User Profile (Milestone 1, branch `feature/user-profile`)

> Step 1 of the Development Flow (RULE.md §0).
> Sources: WORKFLOW.md §5 (Users Module endpoints), §7 Milestone 1 task 1.9, RULE.md §5,
> CLAUDE.md Resolved Decisions #4, #5, #6, #13, #15. Builds on [auth.md](auth.md).

---

## 1. Scope

### In scope

| Method | Path | Access | Purpose |
|---|---|---|---|
| PATCH | `/api/v1/users/profile` | Authenticated | Update the current user's profile |
| PATCH | `/api/v1/users/password` | Authenticated | Change password (requires the current password) |

Reading the profile already exists: `GET /api/v1/auth/me` (auth branch). No duplicate `GET /users/profile`.

### Out of scope (deferred)

| Item | Reason | Planned for |
|---|---|---|
| `PATCH /users/avatar` | Needs the file upload module (Cloudinary) | Milestone 3 (WORKFLOW.md task 3.6) |
| Changing the email | Needs email verification of the new address | Not planned in WORKFLOW.md |
| Deleting the account (soft delete) | Not in WORKFLOW.md | — |
| Rate limiting on `PATCH /password` | Same hardening branch as login/register (Decision #16) | Hardening branch |
| Invalidating access tokens issued before a password change | Needs a schema change (see §5) | Proposal, not planned |

### Database

Tables: `users`, `refresh_tokens`. **No schema change.**

Not tenant-scoped: a user edits only their own row, identified by the access token (`@CurrentUser()`), never by an id in the URL or body.

---

## 2. Shared Rules

- The target user is **always** the authenticated user (`req.user.id`). Neither endpoint accepts a user id, so a user cannot edit someone else.
- The user is loaded with the same rule as the guard: not soft-deleted and `isActive` (the guard already rejects others with 401).
- Unknown body fields are stripped (mass assignment: `email`, `isActive`, `password` in the profile body are ignored).
- Responses use the standard format and `@ZodResponse` (Decision #13).

---

## 3. Endpoints

### 3.1 PATCH `/users/profile`

**Input (body):** `{ fullName? }`

| Field | Rule |
|---|---|
| `fullName` | Optional. Same rule as register: HTML stripped, trimmed, 1–100 chars |

- The body must contain **at least one** updatable field. `{}` → `400` (`"At least one field is required"`).
- Only `fullName` is updatable for now. The schema is an object so `avatarUrl` (Milestone 3) and other fields can be added without changing the endpoint.

**Flow:**
1. Validate input.
2. Update the current user with the given fields.
3. Return `200` with `UserResponseDto` (same shape as `GET /auth/me`).

**Errors:**

| Case | Status |
|---|---|
| Empty body / invalid `fullName` | 400 with field details |
| Missing or invalid access token | 401 (guard) |

### 3.2 PATCH `/users/password`

**Input (body):** `{ currentPassword, newPassword }`

| Field | Rule |
|---|---|
| `currentPassword` | Non-empty, ≤ 72 bytes. No strength rule (same as login) |
| `newPassword` | Same policy as register: ≥ 8 chars, 1 uppercase, 1 digit, ≤ 72 bytes |

**Flow:**
1. Validate input.
2. `newPassword` equal to `currentPassword` → `400` (`"New password must be different from the current password"`).
3. Load the current user's password hash. Compare `currentPassword` with bcrypt. No match → `400` (`"Current password is incorrect"`).
4. Hash `newPassword` (bcrypt, 10 rounds) and save it.
5. **Revoke every session of the user** (delete all their `refresh_tokens` rows).
6. Clear the refresh cookie in the response.
7. Return `200` with `data: null`.

Steps 4 and 5 run in **one transaction**: the password must never change while old sessions survive (or the reverse).

**Errors:**

| Case | Status | Message |
|---|---|---|
| Invalid input (weak `newPassword`, empty `currentPassword`...) | 400 | Field details |
| `newPassword` = `currentPassword` | 400 | `New password must be different from the current password` |
| Wrong `currentPassword` | 400 | `Current password is incorrect` |
| Missing or invalid access token | 401 | (guard) |

**Why 400 and not 401 for a wrong current password:** the user IS authenticated; only a form field is wrong. A 401 would also make the web app's HTTP client think the session expired and start the refresh / logout flow.

**Why revoke every session, including the current device:**
- Changing a password is the usual reaction to "someone may know my password". Sessions opened with the old password must end, or the attacker keeps access through their refresh token.
- The refresh cookie has `path=/api/v1/auth`, so the browser does not send it to `/users/password`: the server cannot tell which session is "the current one" to keep. Revoking all is the simple, safe choice.
- **Client behavior:** after a `200`, the web app shows "Password changed, please log in again" and goes to the login page.

**Why clear the cookie:** after step 5, the cookie points to a deleted session. If the browser sent it to `/auth/refresh`, the server would see a valid JWT without a session and report a **false "refresh token reuse"** (spec auth §3.3 step 4). Clearing it avoids the false alarm. Setting a `Set-Cookie` for `path=/api/v1/auth` from a response of `/api/v1/users/password` is allowed.

---

## 4. Acceptance Criteria

**Profile**
- [ ] `PATCH /users/profile { fullName }` → 200 with the updated `UserResponseDto`; `GET /auth/me` returns the new name.
- [ ] `fullName` with HTML tags is stored without the tags.
- [ ] `{}` → 400; `fullName: ""` or 101 chars → 400.
- [ ] Extra fields (`email`, `isActive`, `password`) are ignored: the stored email, status and password are unchanged.
- [ ] Without a token → 401.

**Password**
- [ ] Correct `currentPassword` + valid `newPassword` → 200, `data: null`, refresh cookie cleared.
- [ ] Afterwards: login with the new password works, login with the old one → 401.
- [ ] **All** refresh sessions of the user are gone: refreshing with a cookie from before the change (from any device) → 401.
- [ ] Wrong `currentPassword` → 400 `Current password is incorrect`; the password is unchanged and sessions survive.
- [ ] Weak `newPassword` → 400 with field details; `newPassword` = `currentPassword` → 400.
- [ ] The stored value is a bcrypt hash, never the plain password.
- [ ] Without a token → 401.

**Quality (RULE.md)**
- [ ] Unit tests for every service method, integration tests for both endpoints, run against the test database.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass.

---

## 5. Known Limitation

After a password change, an **access token** issued before it keeps working until it expires (≤ 15 min). JWTs are stateless and the guard only checks `isActive` / `deletedAt`.

A full fix would add `users.passwordChangedAt` and make the guard reject tokens whose `iat` is older. It needs a schema change, so it is a proposal for a later hardening branch, not part of this one. The refresh sessions, which last 7 days, ARE revoked immediately.
