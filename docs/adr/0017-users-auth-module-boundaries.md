# ADR-0017: Module boundaries between auth and users

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1, branch `feature/user-profile`)

## Context
Users needs password rules, `canSignIn`, the refresh cookie and session revocation from auth, but `AuthModule` already imports `UsersModule`. Importing back would create a cycle (RULE.md §1).

## Decision
- Field schemas in `common/types/user-fields.schema.ts`.
- Refresh cookie in `common/cookies/` (`CookieModule`, reads `jwtConfig`, not `TokenService`).
- `canSignIn` in `modules/users/user.rules.ts`.
- Sessions revoked by a Prisma nested write in `UsersRepository` (`refreshTokens: { deleteMany: {} }`, one atomic statement).
- Dependencies point one way: auth → users. No `forwardRef`.
- Wrong current password → 400, not 401.

## Consequences
- Access tokens issued before a password change stay valid ≤ 15 min (proposal: `passwordChangedAt`, M7 hardening). Open sockets of that user are disconnected at once (ADR-0025).
- Details: `docs/plans/user-profile.md`.
- Later cross-module side effects use domain events instead of imports (ADR-0026).
