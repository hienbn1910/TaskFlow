# ADR-0001: Error responses include `success: false`

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Context
RULE.md §6 showed an error body without a `success` field. WORKFLOW.md §5 showed `success: false`. Clients need one shape to branch on.

## Decision
Follow WORKFLOW.md §5. Every error response has `success: false`, `statusCode`, `error` (machine code), `message`, optional `details[]`, `timestamp` and `requestId` (ADR-0035). Success responses have `success: true` and `data` (+ `meta` for lists).

## Consequences
- The global exception filter and the response interceptor produce the two shapes. Clients check `success` only.
- WebSocket errors use the same fields (ADR-0025).
