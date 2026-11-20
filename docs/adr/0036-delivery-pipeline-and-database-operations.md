# ADR-0036: Delivery pipeline and database operations

- **Status:** Accepted (amends Decision #12)
- **Date:** 2026-11-21

## Context
The plan did not say when production migrations run, which connection string the CLI uses, how a schema change and the code that needs it are ordered, or what Vercel preview deployments connect to.

## Decision
1. **Environments:** local (Docker), test (`postgres-test` locally, service containers in CI), production. No staging (free tier).
2. **Vercel preview deployments disabled.** Through the proxy (ADR-0020) they would use the production API, data and cookies.
3. **CI (GitHub Actions)**
   - On every PR: install → lint → typecheck → unit tests → integration + E2E tests (Postgres and Redis service containers) → `openapi.json` up to date (ADR-0033) → web build → `pnpm audit --prod` (report only).
   - On push to `main`: the same, then `prisma migrate deploy` against Neon, then the Render **deploy hook**. Render auto-deploy is off, so new code never runs before its migration. Vercel deploys the web app from `main`.
4. **Two database URLs**
   - `DATABASE_URL`: Neon **pooled** endpoint, used by the running app (`adapter-pg`).
   - `DIRECT_DATABASE_URL`: **direct** endpoint, used by the Prisma CLI (`prisma7.config.ts`), because migrations need session features the pooler does not give.
   - Locally both point to the same database.
5. **Expand → migrate → contract.** A migration must work with the code that is currently deployed:
   - add (nullable column, new table, new index) first;
   - backfill;
   - switch the code;
   - drop the old part in a **later** release.
   Never rename or drop in the same release as the code change. Generated SQL is reviewed by hand (partial indexes ADR-0022, timestamp conversion ADR-0023).
6. **Seeds:** `prisma/seed.ts` = development data, idempotent (upserts). `seed:demo` = demo workspace + demo account, run **by hand** once against production, never on deploy.
7. **Backups:** manual `pg_dump` before a risky migration; otherwise the provider's restore window.
8. **Dependencies:** Dependabot weekly.
9. **Secrets** only in Render, Vercel and GitHub secret stores. `.env.example` lists every key.

## Consequences
- `prisma7.config.ts` reads `DIRECT_DATABASE_URL` (falls back to `DATABASE_URL` locally). Changed in M2.
- A deploy = one merge to `main`. A failed migration stops the pipeline before the new code ships.
