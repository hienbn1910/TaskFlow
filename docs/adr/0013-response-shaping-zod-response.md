# ADR-0013: `@ZodResponse` on every endpoint

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Decision
Every endpoint declares `@ZodResponse({ type: XxxResponseDto })`. The global `ZodSerializerInterceptor` parses the return value with that schema and strips unknown fields.

## Consequences
A second safety net (after the mapper) against leaking raw Prisma fields such as `password`. WebSocket payloads reuse the same response schemas (ADR-0033), so they get the same protection.
