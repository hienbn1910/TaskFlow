# ADR-0002: Prisma files live in `apps/api/prisma/`

- **Status:** Accepted
- **Date:** 2026-11 (Milestone 1)

## Context
RULE.md §1 placed `schema.prisma`, migrations and seed under `src/prisma/`. The Prisma CLI expects them outside `src/`.

## Decision
`apps/api/prisma/` holds `schema.prisma`, `migrations/` and seed scripts. `apps/api/src/prisma/` holds only `PrismaService` and `PrismaModule`.

## Consequences
Build output contains no schema or migration files. The CLI works with its default paths.
