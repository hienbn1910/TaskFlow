# CLAUDE.md — Taskflow Project Instructions

> This file is the **single entry point** for any AI agent working on this project.
> Read this FIRST. Follow every instruction. No exceptions.

---

## Project Overview

**Taskflow** is a multi-tenant SaaS collaboration platform with real-time messaging, Kanban boards, and workspace management. Built as a portfolio project demonstrating enterprise-level architecture.

- **Backend:** NestJS + Prisma + PostgreSQL + Redis + Socket.io + BullMQ
- **Frontend:** React + Vite + TanStack Query + Zustand + Socket.io-client
- **Architecture:** Modular monolith (one process: API, gateway, workers), multi-tenant with row-level isolation via `workspaceId`, deployed on free tiers within a written capacity budget

---

## Required Reading (Must read before ANY code generation)

1. **`RULE.md`** — Code standards, development flow, architecture rules, security requirements, performance checklist. Contains Section 0 (Development Flow) which defines the mandatory 10-step process for every feature.

2. **`WORKFLOW.md`** — Full project plan: non-functional requirements and capacity budget (§3), architecture and critical flows, database schema (14 tables), API endpoints and WebSocket events, feature specifications, 7 vertical-slice milestones with completion criteria, deployment plan.

3. **`docs/adr/`** — Architecture Decision Records. Read the ADRs listed for the current milestone before its spec. They override conflicting text elsewhere.

4. **`apps/api/prisma/schema.prisma`** — Source of truth for the tables already built. Never contradict this file.

5. **`GLOSSARY.md`** — The domain language: one name per concept (User, Member, Member role, Channel Member, Done column…). Use these names in code, API, UI and docs; never the words listed under `_Avoid_`.

---

## Development Flow (Summary)

Every feature MUST follow this flow — no skipping steps:

```
Spec → Plan (+ seams) → Decompose Tasks → [Red: failing test → Green: minimal code] × each slice
  → Run full suite → Fix → Review (spec, standards, performance, security) → Refactor → PR
```

Test-first (ADR-0039). Full details in **RULE.md Section 0**.

---

## Agent skills

Project skills live in `.claude/skills/` (index, sources and every change from upstream: [`.claude/skills/README.md`](.claude/skills/README.md)). Use them at these steps of RULE.md §0:

| Step | Skill | What it does here |
|---|---|---|
| 1 Spec, open questions | `grilling` (or `/grill-me`) | Settles decisions in rounds of ≤ 5 numbered questions with a recommended answer; never re-asks what an ADR decided |
| 1–2 when domain words change | `domain-modeling` (or `/grill-with-docs`) | Keeps `GLOSSARY.md` exact; proposes ADRs that meet the criteria in `docs/adr/README.md` |
| 2 Plan, 4–5 Red → Green | `tdd` | Lists "Seams under test" in the plan; then one failing test → minimal code per slice; for ⚠️ parts the agent writes only the failing test |
| 7 Fix (hard bugs) | `diagnosing-bugs` | Feedback loop first, ranked hypotheses shown to the developer, regression test before the fix |
| 8 Review | `review-against-spec` | Diff vs spec and vs RULE.md / GLOSSARY / ADRs, two separate reports |
| 10 PR | `pr` | Ready-to-paste title and body (Summary, Evidence, Merge Danger, Decisions); the developer opens the PR |
| Long sessions | `/handoff` | Handoff document in `%TEMP%` for the next session |

Not used on purpose: `implement`, `implement-spec`, `triage`, `wayfinder`, `to-spec`, `to-tickets`, `codebase-design` and others (reasons in the README). A skill never overrides RULE.md, an ADR or this file: on conflict, fix the skill in a branch.

---

## AI Agent Behavior Rules

### Before Writing Code
- [ ] Read RULE.md (especially Section 0 and Section 10; Section 11 for frontend code)
- [ ] Read the ADRs listed for the milestone and the relevant parts of WORKFLOW.md
- [ ] Check existing code — never duplicate what already exists
- [ ] Identify the module, data flow, and all files to create/modify

### While Writing Code
- Test first: one failing test at an approved seam, then the minimal code that turns it green (RULE.md §7)
- For ⚠️ parts: write the failing test only; the developer writes the code
- Follow Controller → Service → Repository pattern strictly
- Every tenant-scoped query MUST include `workspaceId` — no exceptions
- Use Zod for validation, not class-validator
- Never return raw Prisma models — always map to response DTOs
- No `any` type — use `unknown` and narrow
- Functions max 30 lines, max 3 parameters
- Always async/await, never .then()/.catch()
- Publish domain events only after commit; never call the gateway or mailer directly from a service

### After Writing Code
- Every endpoint and socket event has integration tests; pure logic has unit tests; only system boundaries are mocked
- Run full test suite — ensure no regression
- Review the diff against the spec and RULE.md (skill `review-against-spec`)
- Check against Performance Checklist (RULE.md Section 4)
- Check against Security Requirements (RULE.md Section 5)
- Refactor if needed, then create PR

### Communication Style
- Explain decisions briefly in Vietnamese when asked
- When encountering ambiguity, state assumptions and proceed — don't block on questions
- If a task conflicts with RULE.md or WORKFLOW.md, flag it and follow the rule files

---

## Project Structure

```
taskflow/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── common/               # Shared: guards, filters, interceptors, pipes, decorators
│   │   │   ├── config/               # Zod-validated environment config
│   │   │   ├── modules/              # Feature modules (auth, workspace, channel, message, board, task, notification)
│   │   │   ├── prisma/               # PrismaService + PrismaModule only
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/                   # schema.prisma, migrations, seed (Prisma CLI convention)
│   │   ├── test/                     # E2E tests
│   │   └── package.json
│   └── web/                          # React + Vite frontend (from M2, RULE.md §11)
│       ├── src/
│       └── package.json
├── .claude/skills/                   # Project agent skills (committed; local .claude/* files are ignored)
├── docs/
│   ├── adr/                          # Architecture Decision Records (index: README.md)
│   ├── specs/ plans/ tasks/          # Per-branch spec, plan, task list (RULE.md §0)
├── GLOSSARY.md                       # Domain language
├── docker-compose.yml                # PostgreSQL (dev + test) + Redis (+ Mailpit from M6)
├── pnpm-workspace.yaml               # pnpm workspaces monorepo
├── RULE.md                           # Code rules and standards
├── WORKFLOW.md                       # Project plan and specifications
├── WORKFLOW-VI.md                    # Vietnamese translation + glossary (same PR as WORKFLOW.md)
└── CLAUDE.md                         # This file
```

---

## Key Architecture Decisions

Summary only — the reasons are in the ADRs.

### Capacity and Topology (WORKFLOW.md §3, ADR-0018, 0019)
- One NestJS process (API + Socket.io + BullMQ workers), one instance, Singapore region for Render, Key Value and Neon
- Free-tier budgets: Neon awake ≤ ~400 h/month → periodic work at most hourly, `/health` never touches the DB
- No application cache until a measurement asks for one; `Cache-Control: no-store`

### Multi-Tenant Isolation (ADR-0021)
- Every tenant table has a non-null `workspaceId`; composite FKs keep children in their parent's workspace
- WorkspaceGuard validates membership on every request; workspaceId comes from URL params, NEVER from the body
- Non-members get 404; integration tests verify isolation over HTTP and sockets

### Authentication (Decision #5, #15, ADR-0020, 0031)
- JWT access token: 15 min, in memory (frontend). Refresh token: 7 days, httpOnly `SameSite=Lax` cookie, rotated, reuse revokes all sessions
- Global `JwtAuthGuard`; `@Public()` opts out. Origin check on cookie routes. Rate limits from M2
- Production web and API share one origin through the Vercel `/api` proxy

### Real-Time (ADR-0025)
- Handshake with the access token; disconnected at expiry or on session revocation
- Rooms `user:` / `workspace:` / `channel:` / `board:`, each join authorized; private channel data only in its channel room
- Events `resource:verb` (`message:created`, `task:moved`, `notification:created`…); best effort, client resyncs after reconnect

### Side Effects and Background Jobs (ADR-0026, 0027, 0028)
- Domain events after commit; pushes and in-app notifications best effort; emails at least once via a DB flag + hourly sweep
- BullMQ on Render Key Value; Redis is disposable; one hourly tick (reminders, sweep) + daily cleanup

### Pagination (ADR-0024)
- Messages: cursor `(createdAt, id)`, `before` / `after`
- Other lists: offset, `limit` ≤ 100

### Kanban Positioning (Decision #9, decided in M5)
- Proposal: gap-based float positions (increment 1000), rebalance when gap < 1, moves in one locking transaction

---

## Tech Stack Quick Reference

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + NestJS | Enterprise patterns, DI, modular |
| Database | PostgreSQL (Neon for prod) | Relational, ACID, row-level security |
| ORM | Prisma | Type-safe, migrations, schema-first |
| Queue | BullMQ + Redis (Render Key Value for prod) | Retries, repeatable jobs; Redis disposable (ADR-0027) |
| Auth | JWT (access + refresh), custom guard | Stateless, rotation for security (Decision #15) |
| Validation | Zod (`nestjs-zod`) | Runtime + TypeScript inference + OpenAPI |
| WebSocket | Socket.io | Room-based, acks, auto-reconnect |
| Frontend | React + Vite | Fast HMR, SPA |
| State | Zustand + TanStack Query | Server state vs client state separation |
| API contract | Committed `openapi.json` → generated client | No hand-written FE types (ADR-0033) |
| Email / files | Resend (HTTP API) / Cloudinary (signed direct upload) | SMTP blocked on Render free; no file bytes through the API |
| Observability | pino, request id, Sentry, UptimeRobot | ADR-0035 |
| Deploy | Render (API) + Vercel (web + `/api` proxy) + Neon | Free tier; CI migrates then triggers the deploy hook (ADR-0036) |

---

## Current Milestone

Milestones are vertical slices (backend + frontend + tests, deployed), re-planned on 2026-11-21 (ADR-0037). Full plan: WORKFLOW.md §7.

| # | Milestone | Status |
|---|---|---|
| M1 | Foundation & Auth API | ✅ Done |
| M2 | Web foundation, auth UI, production walking skeleton | **Next** |
| M3 | Workspaces, members, invitations | |
| M4 | Channels, real-time messaging, uploads | |
| M5 | Kanban boards | |
| M6 | Notifications, email, background jobs | |
| M7 | Hardening, polish & launch | |

**Milestone 2: Web Foundation, Auth UI & Production Walking Skeleton**

Read first: ADR-0006, 0019, 0020, 0023, 0031, 0033, 0034, 0035, 0036.

Branch plan: `chore/api-production-readiness` → `feature/web-foundation` → `feature/web-auth` → `chore/deploy-pipeline`.

- [x] `chore/api-production-readiness`: timestamptz + partial unique email migration, `DIRECT_DATABASE_URL`, cookie `SameSite=Lax` + Origin check, `trust proxy` + `no-store`, rate limiting, pino logs + request id, `/health/ready`, `openapi.json` export
- [ ] `feature/web-foundation`: Vite + React + TS strict, Tailwind, router, generated API client, single-flight refresh, in-memory auth store, Vite proxy
- [ ] `feature/web-auth`: login, register, profile, change password, logout
- [ ] `chore/deploy-pipeline`: Neon + Render + Key Value (Singapore), Vercel proxy, GitHub Actions, Dependabot, UptimeRobot, Sentry; measure the WORKFLOW.md §3 risks

Completion criteria (on production): register / login / reload stays logged in (Chrome and Safari), profile and password work, 6th rapid login → 429, `requestId` traceable in logs, merge to `main` deploys automatically, login p95 recorded in WORKFLOW.md §3.

---

## Resolved Decisions

Every decision is an ADR in [`docs/adr/`](docs/adr/README.md): context, decision, alternatives, consequences. ADRs override conflicting text in WORKFLOW.md and RULE.md. `Decision #N` in code comments = `ADR-000N`. Read the ADRs listed for a feature before building it.

| # | Decision (one line) | Status |
|---|---|---|
| [1](docs/adr/0001-error-response-format.md) | Error responses include `success: false` | Accepted |
| [2](docs/adr/0002-prisma-file-location.md) | Prisma schema/migrations/seed in `apps/api/prisma/`; `src/prisma/` = service + module only | Accepted |
| [3](docs/adr/0003-docker-compose-infrastructure-only.md) | Compose runs postgres (5432), postgres-test (5433, tmpfs), redis; API runs with `pnpm dev` | Accepted |
| [4](docs/adr/0004-users-soft-delete.md) | `users.deletedAt` (soft delete) | Accepted |
| [5](docs/adr/0005-refresh-token-storage.md) | Refresh JWT only in httpOnly cookie, DB stores `sha256`, reuse revokes all sessions | Accepted, amended by 20 |
| [6](docs/adr/0006-password-hashing-bcryptjs.md) | `bcryptjs`, cost 10 | Accepted, re-measure in M2 |
| [7](docs/adr/0007-validation-zod.md) | Zod via `nestjs-zod` | Accepted |
| [8](docs/adr/0008-websocket-event-names.md) | WebSocket event names | Superseded by 25 |
| [9](docs/adr/0009-kanban-position-type.md) | Kanban `position` type (proposal: Float, gap-based) | Deferred to M5 |
| [10](docs/adr/0010-bull-vs-bullmq.md) | Bull vs BullMQ | Superseded by 27 |
| [11](docs/adr/0011-package-versions.md) | NestJS 11, TS 5.9, Prisma 7.10, Zod 4, `@nestjs/jwt` 11.x | Accepted |
| [12](docs/adr/0012-prisma-7-specifics.md) | `prisma7.config.ts`, client in `src/generated/prisma`, `adapter-pg` | Accepted, amended by 36 |
| [13](docs/adr/0013-response-shaping-zod-response.md) | `@ZodResponse` on every endpoint | Accepted |
| [14](docs/adr/0014-jest-commonjs.md) | Jest runs CommonJS; `pnpm typecheck` checks tests | Accepted |
| [15](docs/adr/0015-custom-jwt-guard.md) | Custom global `JwtAuthGuard`, no Passport, user reloaded per request | Accepted |
| [16](docs/adr/0016-deferred-password-reset-and-rate-limit.md) | Password reset in M6; rate limiting deferred | Amended by 31, 37 |
| [17](docs/adr/0017-users-auth-module-boundaries.md) | Auth → users module boundaries, no cycles | Accepted |
| [18](docs/adr/0018-modular-monolith-single-instance.md) | Modular monolith: API + gateway + workers in one process, one instance; scale-out path documented | Accepted |
| [19](docs/adr/0019-region-colocation-no-cache.md) | Render, Key Value, Neon in one region (Singapore); no app cache until measured; `Cache-Control: no-store` | Accepted |
| [20](docs/adr/0020-same-origin-proxy-cookie-csrf.md) | Vercel/Vite proxy `/api` → same origin; cookie `SameSite=Lax`; Origin check on cookie routes; socket direct with token | Accepted |
| [21](docs/adr/0021-tenant-key-on-every-table.md) | `workspaceId` on every tenant table + composite FKs `(workspaceId, parentId)` | Accepted |
| [22](docs/adr/0022-soft-delete-and-uniqueness.md) | Delete kind per entity; partial unique indexes; invitations PENDING → ACCEPTED/REVOKED, token hashed | Accepted, amended in M2 (Prisma `partialIndexes`) |
| [23](docs/adr/0023-timestamptz-utc.md) | Every `DateTime` is `@db.Timestamptz(3)`; database session time zone pinned to UTC | Accepted, amended in M2 |
| [24](docs/adr/0024-messaging-data-model.md) | Cursor `(createdAt, id)`; one-level threads with counters; unread in one query; 4,000-char limit; `clientMessageId`; raw SQL policy | Accepted |
| [25](docs/adr/0025-realtime-design.md) | Socket auth lifecycle; rooms `user`/`workspace`/`channel`/`board`; `resource:verb` events; best-effort + resync | Accepted |
| [26](docs/adr/0026-domain-events-after-commit.md) | Domain events after commit; data = transaction, pushes = best effort, emails = DB flag + sweep | Accepted |
| [27](docs/adr/0027-background-jobs-bullmq-disposable-redis.md) | BullMQ on Render Key Value; Redis disposable; all periodic jobs on one hourly tick | Accepted |
| [28](docs/adr/0028-deadline-reminders-hourly-scan.md) | Reminders by hourly scan + `reminderSentAt` | Accepted |
| [29](docs/adr/0029-email-delivery.md) | `MailService` port, HTTP API in prod, Mailpit locally, links to `FRONTEND_URL`, email verification in M6 | Accepted, domain open |
| [30](docs/adr/0030-file-uploads.md) | Signed direct upload to Cloudinary; attachments `authenticated`; no SVG/HTML | Accepted |
| [31](docs/adr/0031-rate-limiting-before-deploy.md) | `@nestjs/throttler` in memory from M2; limits table | Accepted |
| [32](docs/adr/0032-concurrency-rules.md) | Uniqueness in DB; atomic invitation accept; single owner + transfer; last write wins | Accepted |
| [33](docs/adr/0033-api-contract-openapi-codegen.md) | Committed `openapi.json` → generated FE client; socket payloads = REST DTOs | Accepted |
| [34](docs/adr/0034-frontend-architecture.md) | Server state in TanStack Query only; ids in URL; single-flight refresh; one realtime module | Accepted |
| [35](docs/adr/0035-observability.md) | pino JSON logs, request id, Sentry, liveness (no DB) vs readiness | Accepted |
| [36](docs/adr/0036-delivery-pipeline-and-database-operations.md) | CI → migrate → deploy hook; pooled vs direct URL; expand–contract; no preview deploys | Accepted |
| [37](docs/adr/0037-vertical-slice-milestones.md) | Every milestone = BE + FE + tests, deployed from M2 | Accepted |
| [38](docs/adr/0038-documentation-sources-of-truth.md) | One source of truth per topic; WORKFLOW-VI.md updated in the same PR | Accepted |
| [39](docs/adr/0039-test-first-at-agreed-seams.md) | Test-first (red → green per slice); seams approved in the plan; endpoint tests with the real DB first; mock only system boundaries; agent writes red, developer writes green for ⚠️ parts | Accepted |

---

## Commands

```bash
pnpm install                       # also runs prisma generate
docker compose up -d               # postgres (5432), postgres-test (5433), redis
pnpm --filter api db:migrate       # apply migrations to dev DB
pnpm --filter api db:migrate:test  # apply migrations to test DB
pnpm dev                           # start API in watch mode
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e   # must all pass before a PR
```

---

## Git Conventions

### Commit Messages
```
feat(workspace): add member invitation flow
fix(auth): refresh token rotation not invalidating old token
refactor(tasks): extract position calculation to utility
test(channels): add integration tests for CRUD endpoints
```

### Branch Naming
```
feature/workspace-invitation
fix/auth-refresh-token
refactor/task-ordering
```

### Rules
- One feature per branch
- Every PR must pass: lint, type check, all tests
- Never commit: .env, node_modules, dist/, .DS_Store

---

## Do NOT

- Skip any step in the Development Flow (RULE.md Section 0)
- Write business logic in controllers
- Call Prisma directly from services (use repositories)
- Return raw Prisma models to the client
- Write queries without workspaceId for tenant-scoped data
- Use `any`, non-null assertions (`!`), or type assertions (`as`) without justification
- Use class-validator — always Zod
- Use .then()/.catch() — always async/await
- Commit .env files or secrets
- Generate code without reading RULE.md first
