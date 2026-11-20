# ADR-0012: Prisma 7 configuration

- **Status:** Accepted (amended by ADR-0036: separate direct URL for migrations)
- **Date:** 2026-11 (Milestone 1)

## Decision
- Config file: `apps/api/prisma7.config.ts` (Prisma 7.10 default name).
- Client generated to `src/generated/prisma` (gitignored, regenerated on `postinstall`), imported via `@prisma-client/client`.
- Connection through the `@prisma/adapter-pg` driver adapter.

## Consequences
The generated client is never committed. The config's datasource URL is used by the CLI (migrations), the adapter's connection string by the running app, so the two can point to different endpoints (ADR-0036).
