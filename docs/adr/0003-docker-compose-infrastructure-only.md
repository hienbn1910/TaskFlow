# ADR-0003: Docker Compose runs infrastructure only

- **Status:** Accepted (extended by ADR-0029: Mailpit added in M6)
- **Date:** 2026-11 (Milestone 1)

## Context
The original WORKFLOW.md compose file built a `./backend` image. Running the API inside Docker slows hot reload on Windows and duplicates what `pnpm dev` does.

## Decision
`docker-compose.yml` runs `postgres` (dev, port 5432), `postgres-test` (port 5433, tmpfs, wiped on restart) and `redis`. The API runs on the host with `pnpm dev`.

## Consequences
Fast reload. Integration tests always start from an empty database. Render builds Node apps natively, so no production `Dockerfile` is required.
