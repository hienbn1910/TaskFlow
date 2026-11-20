# ADR-0015: Custom global JWT guard, no Passport

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Context
WORKFLOW.md §2 listed Passport.js. Passport's `validate(payload: any)` conflicts with the no-`any` rule, and only JWT is needed.

## Decision
`JwtAuthGuard` (`common/guards`) is written with `@nestjs/jwt`:
- registered as a global `APP_GUARD`; `@Public()` opts a route out;
- HS256 pinned; payload validated with Zod;
- the user is reloaded on every request, so a blocked or deleted account loses access at once.

## Consequences
- One extra primary-key query per request (~2 ms in-region, WORKFLOW.md §3 latency budget). No user cache (ADR-0019).
- OAuth login, if added later, issues our own JWT pair and does not change the guard.
- The WebSocket gateway applies the same checks at handshake and when the token expires (ADR-0025).
