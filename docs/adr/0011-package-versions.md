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

## Consequences
Re-evaluate when these blockers are lifted. Every new dependency is checked against Decision #14 (CommonJS in Jest) before it is added.
