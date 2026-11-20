# ADR-0005: Refresh token only in an httpOnly cookie, stored hashed, reuse revokes all sessions

- **Status:** Accepted (amended by ADR-0020: `SameSite=Lax` behind a same-origin proxy)
- **Date:** 2026-11 (Milestone 1)

## Context
A refresh token lives 7 days. If JavaScript can read it, one XSS steals a week-long session. If the database stores it in plain text, a database leak does the same.

## Decision
- The refresh JWT is only ever in an httpOnly cookie, never in a response body.
- The database stores `sha256(token)`.
- Tokens rotate on every refresh. Presenting a token that was already rotated (reuse) revokes **every** session of that user.

## Consequences
Stolen tokens have a short useful life. A legitimate user whose token was stolen is logged out everywhere, which is the intended signal. The same "store only the hash" rule applies to invitation tokens (ADR-0022) and password-reset tokens (M6).
