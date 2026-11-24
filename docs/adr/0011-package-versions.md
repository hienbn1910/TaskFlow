# ADR-0011: Package versions

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Decision
NestJS 11, TypeScript 5.9, Prisma 7.10, Zod 4. `@nestjs/jwt` stays on 11.x.

## Reasons
- Not NestJS 12: `nestjs-zod` supports Nest ≤ 11.
- Not TypeScript 7: `ts-jest` and `typescript-eslint` do not support it yet.
- Not Prisma 8: still a release candidate.
- `@nestjs/jwt` 12.x is ESM-only and Jest runs CommonJS (Decision #14).

## Added in Milestone 2 (`chore/api-production-readiness`)
| Package | Version | Why |
|---|---|---|
| `@nestjs/throttler` | ^6.8 | Rate limiting in memory (ADR-0031); named throttlers |
| `nestjs-pino`, `pino`, `pino-http` | ^5.3, ^10.4, ^11.0 | JSON logs with request id (ADR-0035) |
| `pino-pretty` (dev) | ^13.2 | Readable logs in development only |
| `ioredis` | ^6.0 | Readiness `PING`; reused by BullMQ in M6 (ADR-0027) |
| `express` (dev) | ^5.2 | Types and a bare app for the logger unit test; already the runtime of `@nestjs/platform-express` |

All load in Jest's CommonJS (Decision #14): checked by the unit and E2E suites.

## Consequences
Re-evaluate when these blockers are lifted. Every new dependency is checked against Decision #14 (CommonJS in Jest) before it is added.
