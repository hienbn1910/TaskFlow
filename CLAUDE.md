# CLAUDE.md — Taskflow Project Instructions

> This file is the **single entry point** for any AI agent working on this project.
> Read this FIRST. Follow every instruction. No exceptions.

---

## Project Overview

**Taskflow** is a multi-tenant SaaS collaboration platform with real-time messaging, Kanban boards, and workspace management. Built as a portfolio project demonstrating enterprise-level architecture.

- **Backend:** NestJS + Prisma + PostgreSQL + Redis + Socket.io + Bull
- **Frontend:** React + Vite + TanStack Query + Zustand + Socket.io-client
- **Architecture:** Multi-tenant with row-level isolation via workspaceId

---

## Required Reading (Must read before ANY code generation)

1. **`RULE.md`** — Code standards, development flow, architecture rules, security requirements, performance checklist. Contains Section 0 (Development Flow) which defines the mandatory 10-step process for every feature.

2. **`WORKFLOW.md`** — Full project plan: database schema (12 tables), API endpoints (40+), WebSocket events, feature specifications, 8 milestones with tasks and completion criteria, deployment plan.

3. **`apps/api/prisma/schema.prisma`** — Source of truth for database structure. Never contradict this file.

---

## Development Flow (Summary)

Every feature MUST follow this flow — no skipping steps:

```
Spec → Plan → Decompose Tasks → Generate Code → Generate Tests
  → Run Tests → Fix → Check Performance/Security → Refactor → PR
```

Full details in **RULE.md Section 0**.

---

## AI Agent Behavior Rules

### Before Writing Code
- [ ] Read RULE.md (especially Section 0 and Section 10)
- [ ] Read relevant parts of WORKFLOW.md for the feature being built
- [ ] Check existing code — never duplicate what already exists
- [ ] Identify the module, data flow, and all files to create/modify

### While Writing Code
- Follow Controller → Service → Repository pattern strictly
- Every tenant-scoped query MUST include `workspaceId` — no exceptions
- Use Zod for validation, not class-validator
- Never return raw Prisma models — always map to response DTOs
- No `any` type — use `unknown` and narrow
- Functions max 30 lines, max 3 parameters
- Always async/await, never .then()/.catch()

### After Writing Code
- Generate tests for every service method and endpoint
- Run full test suite — ensure no regression
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
│   └── web/                          # React + Vite frontend
│       ├── src/
│       └── package.json
├── docker-compose.yml                # PostgreSQL (dev + test) + Redis for local dev
├── pnpm-workspace.yaml               # pnpm workspaces monorepo
├── RULE.md                           # Code rules and standards
├── WORKFLOW.md                       # Project plan and specifications
├── WORKFLOW-VI.md                    # Vietnamese translation + glossary
└── CLAUDE.md                         # This file
```

---

## Key Architecture Decisions

### Multi-Tenant Isolation
- Row-level isolation: every tenant-scoped table has `workspaceId`
- WorkspaceGuard validates membership on every request
- workspaceId comes from URL params, NEVER from request body
- Integration tests must verify cross-tenant data isolation

### Authentication
- JWT access token: 15min, stored in memory (frontend)
- JWT refresh token: 7 days, httpOnly cookie, rotates on every use
- All endpoints require `@UseGuards(JwtAuthGuard)` unless explicitly public

### Real-Time
- Socket.io with JWT authentication on connection
- Users join workspace/channel rooms
- Events: message:new, message:updated, message:deleted, notification:new, task:updated, member:online/offline

### Background Jobs
- Bull queues with Redis for: email sending, deadline reminders, stale invitation cleanup
- No heavy computation in request cycle

### Pagination
- Messages: cursor-based (for real-time consistency)
- Other lists: offset-based with configurable limit

### Kanban Positioning
- Gap-based positioning (increment 1000) for drag-drop reordering
- Rebalance when gap < 1

---

## Tech Stack Quick Reference

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + NestJS | Enterprise patterns, DI, modular |
| Database | PostgreSQL (Neon for prod) | Relational, ACID, row-level security |
| ORM | Prisma | Type-safe, migrations, schema-first |
| Cache/Queue | Redis (Upstash for prod) | Bull queues, session cache |
| Auth | JWT (access + refresh) | Stateless, rotation for security |
| Validation | Zod | Runtime + TypeScript inference |
| WebSocket | Socket.io | Room-based, auto-reconnect |
| Frontend | React + Vite | Fast HMR, SPA |
| State | Zustand + TanStack Query | Server state vs client state separation |
| Deploy | Render.com (API) + Vercel (Web) | Free tier, auto-deploy from GitHub |

---

## Current Milestone

**Milestone 1: Project Foundation & Auth**

Tasks:
- [ ] Initialize pnpm monorepo + NestJS project (strict mode)
- [ ] Set up Prisma with schema (users + refresh_tokens)
- [ ] Docker Compose (PostgreSQL dev + test, Redis)
- [ ] Environment variables (.env.example)
- [ ] Config module (Zod env validation)
- [ ] Global exception filter
- [ ] Response interceptor (standard format)
- [ ] Zod validation pipe
- [ ] Swagger at /api/docs + health endpoint
- [ ] Auth module (register, login, refresh, logout, me)
- [ ] JWT strategy + global guard
- [ ] Users module (profile, password)
- [ ] Unit tests + integration tests for auth and users

Completion criteria: User can register, login, receive JWT tokens, refresh them, and logout. All endpoints return standardized response format.

Branch plan: `chore/project-docs` → `chore/project-foundation` → `feature/auth` → `feature/user-profile`.

---

## Resolved Decisions

Conflicts found between the project documents, and how they are resolved. These override the conflicting text in the other files.

| # | Conflict | Decision |
|---|---|---|
| 1 | Error format: RULE.md §6 has no `success` field, WORKFLOW.md §5 has `success: false` | Follow WORKFLOW.md — error responses include `success: false` |
| 2 | Prisma location: `apps/api/prisma/` vs `src/prisma/` | `apps/api/prisma/` holds schema, migrations, seed. `src/prisma/` holds only `PrismaService` / `PrismaModule` |
| 3 | WORKFLOW.md docker-compose builds `./backend` | Compose runs infrastructure only: `postgres` (dev, 5432), `postgres-test` (5433, tmpfs), `redis`. API runs with `pnpm dev` |
| 4 | `users` has no `deletedAt`, but RULE.md §5 requires soft delete for users | Add `deletedAt` to `users` |
| 5 | Refresh token storage | Refresh JWT lives only in an httpOnly cookie (never in the body). DB stores `sha256(token)`; reuse of a rotated token revokes all of the user's sessions |
| 6 | Password hashing library | `bcryptjs` (same bcrypt algorithm, no native build), salt rounds 10 |
| 7 | Validation tooling | Zod via `nestjs-zod` (`createZodDto`, Swagger generation) |
| 8 | Deferred: WebSocket event names (`message:new` vs `new-message`) | Decide at Milestone 3. Proposal: WORKFLOW.md names |
| 9 | Deferred: Kanban `position` type (INTEGER vs gap-based) | Decide at Milestone 4. Proposal: Float for gap-based positioning |
| 10 | Deferred: Bull vs BullMQ | Decide at Milestone 5. Proposal: BullMQ (Bull is maintenance-only) |

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
