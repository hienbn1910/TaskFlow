# TaskFlow — Project Workflow & Master Plan

> The plan for the whole project: scope, architecture, capacity budget, data model, API, features, milestones, deployment.
> Decisions and their reasons live in [`docs/adr/`](docs/adr/README.md). When this file and an ADR disagree, the ADR wins and this file is corrected (ADR-0038).
> Vietnamese translation: [WORKFLOW-VI.md](WORKFLOW-VI.md), updated in the same PR as this file.
> Last updated: 2026-11-21

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [System Architecture](#3-system-architecture) — includes the Non-Functional Requirements & Capacity Budget
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Feature Specifications](#6-feature-specifications)
7. [Milestones & Timeline](#7-milestones--timeline)
8. [Deployment Plan](#8-deployment-plan)
9. [How to Work on This Project](#9-how-to-work-on-this-project)
10. [Reference Files](#10-reference-files)

---

## 1. Project Overview

### What is TaskFlow?

TaskFlow is a **multi-tenant SaaS collaboration platform** where teams can:
- Create isolated workspaces for their organization
- Communicate in real time through channels
- Manage tasks on Kanban boards
- Share files and receive notifications

Think of it as a simplified Slack + Trello combined into one app.

### Why this project?

This project demonstrates to employers that the developer:
- Can build a production-ready SaaS application
- Understands multi-tenancy and data isolation
- Can implement real-time features correctly (authorization, reconnection, consistency)
- Knows authentication, authorization and security best practices
- Can deploy **and maintain** a live application within real constraints (free-tier budgets, observability)
- Writes clean, tested, documented code, and records design decisions with their trade-offs

### Target audience for this portfolio

- Companies hiring **NestJS / Node.js backend developers**
- Companies hiring **fullstack TypeScript developers**
- Companies building **SaaS products**

### Scope

| In scope | Out of scope |
|---|---|
| Email + password accounts, email verification, password reset | OAuth / SSO (the guard allows adding it later, Decision #15). Self-service account deletion (M7 stretch); blocking and deleting Users is an operator action in the database |
| Workspaces, roles, invitations by link and email | Billing, plans, usage limits per customer |
| Public and private channels, one-level threads, attachments, mentions, typing, presence | Direct messages, reactions, message search, voice / video |
| Kanban boards with real-time drag and drop, assignment, due dates, reminders | Task comments, sub-tasks, custom fields |
| In-app and email notifications | Push notifications, notification preferences |
| Responsive web app | Native mobile apps |

---

## 2. Tech Stack & Why

### Backend

| Technology | Purpose | Why chosen |
|---|---|---|
| **NestJS 11** | API framework | Modular architecture, built-in DI, guards / pipes / interceptors, TypeScript-first |
| **TypeScript 5.9** (strict) | Language | Type safety (Decision #11 for versions) |
| **PostgreSQL** (Neon in production) | Primary database, the only durable store | Relational, transactions, partial indexes, composite foreign keys for tenant safety (ADR-0021) |
| **Prisma 7** + `@prisma/adapter-pg` | ORM, migrations | Type-safe queries, schema-first migrations (Decision #12) |
| **`@nestjs/jwt`** + custom `JwtAuthGuard` | Authentication | No Passport: only JWT is needed and Passport's types conflict with the no-`any` rule (Decision #15) |
| **Zod 4** + `nestjs-zod` | Validation, response shaping, OpenAPI | One schema for runtime validation, types and docs (Decision #7, #13) |
| **bcryptjs** | Password hashing | No native build (Decision #6; to re-measure in production) |
| **Socket.io** | Real time | Rooms, acknowledgements, auto-reconnect (ADR-0025) |
| **`@nestjs/event-emitter`** | Domain events | Side effects across modules without imports or cycles (ADR-0026) |
| **BullMQ** + Redis (Render Key Value in production) | Background jobs | Retries with backoff, repeatable jobs. Redis is disposable: every job can be rebuilt from PostgreSQL (ADR-0027) |
| **`@nestjs/throttler`** | Rate limiting | In-memory storage on a single instance (ADR-0031) |
| **nestjs-pino** | Structured logs | JSON, request id, redaction (ADR-0035) |
| **Cloudinary** | File storage | Signed direct uploads, authenticated delivery for private files (ADR-0030) |
| **Resend** (HTTP API) | Email | Render's free tier blocks SMTP; Mailpit catches email locally (ADR-0029) |

### Frontend

| Technology | Purpose | Why chosen |
|---|---|---|
| **React** + **Vite** + **TypeScript** | UI, build | Industry standard, fast HMR |
| **TanStack Query** | Server state | Caching, refetching, optimistic updates. The **only** place server data lives (ADR-0034) |
| **Zustand** | Client state | Access token in memory, socket status, UI preferences |
| **React Router** | Routing | Workspace / channel / board ids live in the URL |
| **OpenAPI codegen** (proposal: orval) | API client | Types, hooks and Zod schemas generated from the backend's `openapi.json` (ADR-0033) |
| **React Hook Form** + generated Zod schemas | Forms | Few re-renders, same rules as the API |
| **Socket.io-client** | Real time | Matches the backend; one realtime module updates the query cache |
| **dnd-kit** | Drag and drop | Modern, accessible — for the Kanban board |
| **Tailwind CSS** | Styling | Utility-first, consistent design tokens |
| **Vitest** + Testing Library, **Playwright** | Tests | Component tests; end-to-end flows (M7) |

### DevOps & Infrastructure

| Technology | Purpose | Why chosen |
|---|---|---|
| **Docker Compose** | Local infrastructure | PostgreSQL (dev + test), Redis, Mailpit. The API runs on the host (Decision #3) |
| **GitHub Actions** | CI/CD | Lint, typecheck, tests, migration, deploy hook (ADR-0036) |
| **Render** (Singapore) | API host + Key Value (Redis) | Free tier, one always-on service (ADR-0018) |
| **Vercel** | Web host + `/api` proxy | Free, static hosting at the edge; the proxy makes the API same-origin (ADR-0020) |
| **Neon** (Singapore) | PostgreSQL | Free tier, scales to zero; pooled + direct endpoints (ADR-0036) |
| **Sentry**, **UptimeRobot** | Error tracking, uptime | Free tiers; keep-alive ping on `/health` (ADR-0035) |
| **Dependabot** | Dependency updates | Weekly |

---

## 3. System Architecture

### Non-Functional Requirements & Capacity Budget

> The numbers every design decision is checked against. Free-tier limits were verified on 2026-11-21.
> Providers change them: re-check before the first deploy and at the start of every milestone.

#### Load profile

| Metric | Expected (demo use) | Design target (must still work) |
|---|---|---|
| Registered users | ≤ 50 | 500 |
| Workspaces | ≤ 10 | 100 |
| Members per workspace | 2–10 | 50 |
| Concurrent WebSocket connections (one per open tab) | ≤ 10 | 100 |
| Messages sent | ~100 / day | 5 / s peak, 5,000 / day |
| REST requests | ~2,000 / day | 20 / s peak |
| Tasks | ~200 total | 10,000 total |
| Attachments | ~20 / month, ~1 MB average | 500 / month, ≤ 10 MB each |

"Expected" sizes the free-tier budget below. "Design target" is what the code must handle without a redesign: indexes, pagination, fan-out and query count are reviewed against it.

#### Service targets

| Target | Value | Notes |
|---|---|---|
| API latency, typical endpoint (warm) | p95 < 200 ms server time, < 400 ms seen from a browser in South-East Asia | Measured in M7 from request logs (`responseTime`) |
| Endpoints that hash a password (register, login, change password) | p95 < 1.5 s | bcrypt cost 10 on a 0.1-CPU instance (see risks) |
| Real-time fan-out (message committed → shown on other clients) | p95 < 500 ms | |
| Cold start when Render is asleep | ~1 min, accepted | Keep-alive ping avoids it (§8) |
| Availability | Best effort, no SLA (free tier) | |
| Durability | Committed data in PostgreSQL is never lost | Redis may lose everything at any time (ADR-0027) |
| Tenant isolation | No cross-tenant read or write is possible | Hard requirement, proven by integration tests |

#### Free-tier limits (verified 2026-11-21)

| Provider | Limit that matters | Consequence for the design |
|---|---|---|
| **Render** web service | 512 MB RAM, 0.1 CPU. 750 instance-hours per workspace per month. Sleeps after 15 min without traffic, ~1 min to wake. **Outbound SMTP ports (25, 465, 587) blocked** | One always-on service uses 744 h (31-day month), so there is room for **exactly one**: API, WebSocket gateway and job workers run in one process (ADR-0018). Email goes through an HTTP API, never SMTP (ADR-0029) |
| **Render** Key Value | 25 MB RAM, 50 connections, no command limit, **in-memory only: data lost on any restart**, one free instance per workspace | Chosen Redis for production (ADR-0027). Nothing may live only in Redis |
| **Upstash** Redis | 500K commands / month (≈ 16K / day) | BullMQ with default settings polls ≈ 20K commands / day per idle queue. Over budget before any real traffic: rejected (ADR-0027) |
| **Neon** PostgreSQL | 100 CU-hours / month per project, min 0.25 CU → **≤ 400 awake hours / month** (the month has 744). Scales to zero after 5 min idle. 0.5 GB storage (plan for the smaller figure; some sources say 1 GB). 5 GB transfer / month | The database must sleep about half of the time. Nothing periodic may touch it more often than hourly, and the keep-alive ping must not touch it (budget below) |
| **Vercel** Hobby | 100 GB bandwidth / month. Non-commercial use only | Also carries the proxied API traffic (ADR-0020). A portfolio is non-commercial |
| **Cloudinary** | 25 credits / month (1 credit ≈ 1 GB storage, or 1 GB bandwidth, or 1,000 transformations) | Size limits per file (ADR-0030) |
| **Resend** (email) | 100 emails / day, 3,000 / month. Sending to arbitrary addresses needs a verified domain | Invitation rate limit per workspace (ADR-0031). Domain question open (ADR-0029) |

#### Back-of-the-envelope estimates

**Storage (Neon, 0.5 GB).** One message row ≈ 200 B of content + ~150 B of columns + ~250 B across its indexes ≈ **0.6 KB**.
- Expected: 100 messages / day × 365 ≈ 36,500 rows / year ≈ **22 MB / year**. Fine for years.
- Design target: 5,000 / day × 365 ≈ 1.8M rows ≈ **1.1 GB / year**: storage is the **first** limit to break, after about 5 months. Mitigations: message content capped at 4,000 characters (ADR-0024), notifications deleted after 90 days (ADR-0027), upgrade path = paid Neon plan. No code change needed.

**Database compute (Neon, ≤ 400 awake hours / month).**
- Hourly jobs: 24 wake-ups / day × ≥ 5 min awake ≈ 2 h / day ≈ **62 h / month ≈ 15.5 CU-h**.
- Left for user traffic: ≈ 84 CU-h ≈ **336 awake hours / month** ≈ 11 h / day. Enough for demo use.
- A job polling every minute (for example a Postgres-based queue, or a readiness check used as keep-alive) would keep the database awake 744 h ≈ 186 CU-h: the quota would run out around day 16. Hence the rules in ADR-0027: periodic work at most hourly, all periodic jobs at the same minute, `/health` never touches the database.

**Redis commands.** Upstash budget ≈ 11 commands / minute. One idle BullMQ queue ≈ 14 / minute (blocking fetch every 5 s + stalled check every 30 s). This is why Render Key Value (no command limit) is used instead.

**Latency budget, warm request, everything in one region (ADR-0019).**

```
Browser (Vietnam) → Vercel edge (Singapore)     ~ 30–50 ms round trip
Vercel edge → Render (Singapore)                ~ 5 ms
JwtAuthGuard: reload user                       ~ 2 ms   (Decision #15)
WorkspaceGuard: membership                      ~ 2 ms
Business query (1–2 queries)                    ~ 2–5 ms
Application CPU on a 0.1-CPU instance           ~ 10–30 ms
                                                ─────────
                                                ≈ 60–100 ms   (target: < 400 ms)
```

If the database were in another region (e.g. `us-east-1` while the API runs in Singapore, ~220 ms round trip), the same three queries would take ~660 ms and break the target on their own. This is why region co-location is a decision (ADR-0019) and why no cache is needed yet.

**Real-time fan-out.** Design target: 5 messages / s × 50 members = 250 socket writes / s on one Node process. Well within a single instance.

#### Risks to verify in the production walking skeleton (M2)

| Risk | How it is checked | Fallback |
|---|---|---|
| bcrypt cost 10 with `bcryptjs` (pure JS) on 0.1 CPU may exceed 1.5 s | Time `POST /auth/login` in production | Switch to native `bcrypt`. Same hash format: existing hashes stay valid (Decision #6 amended) |
| Vercel external rewrite must forward `Set-Cookie`, `Origin` and `X-Forwarded-For` | E2E smoke test on the deployed app: login → reload → still logged in | Custom domain (`app.` + `api.` of one domain) |
| Prisma `adapter-pg` through Neon's pooled (PgBouncer) endpoint | Run the integration suite against a Neon branch | Use the direct endpoint at runtime (single instance, few connections) |
| Render and Neon both available in Singapore | Create the services | Pick the closest region **shared by both** |

#### Explicitly out of scope

Multi-region, high availability, zero-downtime guarantees, horizontal scaling (the path is documented in ADR-0018, not built), backups beyond the provider's restore window (take a manual `pg_dump` before risky migrations).

### High-Level Architecture

A **modular monolith**: one NestJS process runs the HTTP API, the WebSocket gateway and the job workers (ADR-0018). Everything stateful sits in one region (ADR-0019).

```
                          Browser (React SPA)
          │ HTTPS  /api/*  (same origin)               │ WebSocket (direct,
          ▼                                             │ access token in handshake)
  ┌──────────────────────┐                              │
  │ Vercel               │ static files                 │
  │ rewrite /api/* ──────┼──────┐                       │
  └──────────────────────┘      │ HTTPS                 │
                                ▼                       ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Render web service (Singapore) — ONE NestJS process              │
  │                                                                  │
  │  HTTP API          Socket.io gateway        BullMQ workers       │
  │  guards → controllers → services → repositories   + hourly tick  │
  │                         │                                        │
  │                         └── domain events (after commit) ──►     │
  │                             listeners: realtime, notifications,  │
  │                             mail                                 │
  └───────┬──────────────────────┬──────────────────────┬────────────┘
          │                      │                      │ HTTPS
          ▼                      ▼                      ▼
  ┌───────────────┐   ┌────────────────────┐   ┌───────────────────────┐
  │ Neon Postgres │   │ Render Key Value   │   │ Cloudinary (files)  ◄─┼── browser uploads
  │ (Singapore)   │   │ (Redis, Singapore) │   │ Resend (email API)    │   directly (signed)
  │ source of     │   │ queue only,        │   │ Sentry (errors)       │
  │ truth         │   │ disposable         │   └───────────────────────┘
  └───────────────┘   └────────────────────┘
```

### Module Map

Modules depend on each other in one direction only (RULE.md §1). Side effects across modules go through domain events (ADR-0026).

| Module | Owns tables | Publishes events | Listens to | Milestone |
|---|---|---|---|---|
| `auth` | `refresh_tokens`, `user_tokens` | `user.sessions-revoked` | — | M1, M6 |
| `users` | `users` | `user.sessions-revoked` | — | M1 |
| `workspaces` | `workspaces`, `workspace_members` | `workspace.created`, `member.joined`, `member.left`, `member.removed`, `member.role-changed` | — | M3 |
| `invitations` | `invitations` | `invitation.created` | — | M3 |
| `channels` | `channels`, `channel_members` | `channel.created\|updated\|deleted`, `channel.member-added\|removed` | `workspace.created` (create `general`), `member.joined`, `member.left`, `member.removed` | M4 |
| `messages` | `messages`, `message_attachments` | `message.created\|updated\|deleted` | — | M4 |
| `uploads` | — (Cloudinary) | — | — | M4 |
| `realtime` | — (sockets, presence) | — | All events that clients must see; `user.sessions-revoked` | M4 |
| `boards` | `boards`, `board_columns` | `board.*`, `column.*` | — | M5 |
| `tasks` | `tasks` | `task.created\|updated\|moved\|deleted`, `task.assigned` | `member.removed` (unassign) | M5 |
| `notifications` | `notifications` | `notification.created` | `task.assigned`, `message.created`, `member.joined`, `invitation.created`, `reminder.due` | M6 |
| `mail` | — | — | `invitation.created`, account emails | M6 |
| `jobs` | — (queues) | `reminder.due` | — | M6 |
| `health` | — | — | — | M1 |

### Request Flow

```
Client request (through the Vercel proxy)
     │
     ▼
[Express middleware]   helmet · pino-http (X-Request-Id, one log line) · cookie-parser
     │
     ▼
[ThrottlerGuard]       rate limits per IP / user (ADR-0031); real IP via trust proxy
     │
     ▼
[JwtAuthGuard]         global; @Public() opts out; HS256; user reloaded (Decision #15)
     │
     ▼
[WorkspaceGuard]       workspace routes: membership + workspace not deleted;
     │                 attaches workspaceId (from URL only) and role; role check
     ▼
[ZodValidationPipe]    body, params, query (Decision #7)
     │
     ▼
[Controller]           HTTP only: read input, call service
     │
     ▼
[Service]              business rules; transaction through repositories;
     │                 AFTER commit: publish domain events
     ▼
[Repository]           Prisma only; workspaceId as a direct column (ADR-0021)
     │
     ▼
[ZodSerializerInterceptor + ResponseInterceptor]
                       strip unknown fields (Decision #13); { success: true, data, meta? }
     │
     ▼
Client response        Cache-Control: no-store; X-Request-Id

Errors anywhere → GlobalExceptionFilter → { success: false, statusCode, error,
                  message, details?, timestamp, requestId } (Decision #1)
```

### Real-time Architecture (summary of ADR-0025)

```
connect(auth.token) ─► verify like JwtAuthGuard ─► join user:{userId}
                       schedule disconnect at token expiry
workspace:join      ─► check membership ─► join workspace:{id} + channel:{id} of my channels
board:join          ─► check membership ─► join board:{id}

Service commits ─► domain event ─► realtime listener ─► emit to the narrowest room:
   messages / typing → channel:{id}      tasks / columns → board:{id}
   members / public channels / presence → workspace:{id}
   notifications / forced logout → user:{id}

Reconnect ─► re-join rooms ─► refetch what may have been missed (REST is the source of truth)
```

### Background Job Flow (summary of ADR-0026, ADR-0027, ADR-0028)

```
Business transaction writes the need into PostgreSQL (e.g. invitations.email_sent_at IS NULL)
     │ commit
     ▼
Enqueue job with a deterministic jobId ──► BullMQ (Redis, disposable)
     │                                          │
     │                                    worker (in the API process)
     │                                          ├── email job → Resend → set email_sent_at
     │                                          └── fails → retry with backoff (5 attempts)
     ▼
Hourly tick at :00 (one database wake-up per hour)
     ├── reminders.scan: tasks due in ≤ 24 h, reminder_sent_at IS NULL
     ├── email.sweep:    rows still unsent after 10 min → enqueue again
     └── cleanup (daily, 20:00 UTC): notifications > 90 days, expired refresh tokens
```

### Critical Flows

These flows cross several modules. Each step names the decision that governs it.

**1. Send a message (M4)**
```
Browser                API                         PostgreSQL        Other browsers
  │ optimistic message (clientMessageId)
  │ POST …/messages ───►│ guards, validation, rate limit
  │                     │ transaction: insert message (unique clientMessageId),
  │                     │   update parent replyCount if reply ──► commit
  │                     │ publish message.created (after commit, ADR-0026)
  │ ◄── 201 message ────│
  │ replace optimistic  │ realtime listener ─► emit message:created to channel:{id} ──► append if
  │ by id               │                                                                not present
  │ (retry after a network error → same clientMessageId → 200 with the same message, ADR-0024)
```

**2. Reconnect and resync (M4)**
```
Socket drops (network, sleep, deploy)
  → Socket.io reconnects with backoff; the auth callback supplies the current access token
    (refreshed through REST first if expired)
  → server re-authenticates; client emits workspace:join (and board:join if a board is open)
  → client fetches GET …/messages?after=<newest cursor> for the open channel
  → client invalidates: channel list + unread counts, open board, notification count
  → events received during the refetch are deduplicated by id (ADR-0025)
```

**3. Invitation lifecycle (M3, email from M6)**
```
ADMIN: POST …/invitations { email, role }
  → transaction: insert PENDING row (tokenHash, expiresAt = now + 7 days) or rotate the token
    of the existing PENDING row → commit → publish invitation.created
  → M3: response contains the link once (copy link). M6: mail listener enqueues the email
Invitee opens FRONTEND_URL/invite?token=… → page removes the token from the address bar
  → POST /invitations/preview { token } (public, rate limited): workspace, inviter, email, status
  → logs in or registers → POST /invitations/accept { token }
  → transaction: PENDING + not expired → ACCEPTED (exactly 1 row), insert member → commit
  → publish member.joined → channels listener adds the member to "general" (M4),
    notifications listener tells admins (M6), realtime emits member:joined
```

**4. Session in the browser (M2)**
```
App start → POST /auth/refresh (cookie, SameSite=Lax, same origin through the proxy)
  → 200: access token kept in memory; user loaded       → 401: show login
Any request → 401 → single-flight refresh (other requests wait) → retry once
  → refresh fails → clear memory and query cache → login page
Logout → POST /auth/logout → cookie cleared, session deleted → clear caches, disconnect socket
Password change / reuse detected → all sessions revoked → user.sessions-revoked
  → realtime disconnects every socket of the user (ADR-0025)
```

**5. Task assignment and deadline reminder (M5 + M6)**
```
PATCH …/tasks/:id/assign { assigneeId } → assignee must be a workspace member
  → update task (reset reminderSentAt) → commit → publish task.assigned
  → realtime: task:updated to board:{id}
  → M6 notifications listener: TASK_ASSIGNED (dedupeKey) → notification:created to user:{assignee}
Hourly tick → reminders.scan → per task, one transaction: reminderSentAt = now + TASK_DUE_SOON
  → after commit: notification:created + email job (best effort with retries, ADR-0028)
```

---

## 4. Database Design

> Tables already built are defined by `apps/api/prisma/schema.prisma`, which wins over this section (ADR-0038). Tables not built yet are specified here and become "implemented" when their milestone adds them.

### Conventions (apply to every table)

| Rule | Detail | Source |
|---|---|---|
| Primary keys | `id UUID` (v4), generated by Prisma | — |
| Naming | camelCase in Prisma, snake_case in PostgreSQL (`@map`, `@@map`) | RULE.md §2 |
| Timestamps | `timestamptz(3)`, UTC. `createdAt` on every table, `updatedAt` on mutable ones | ADR-0023 |
| Tenant key | Non-null `workspaceId` on every tenant table. Composite foreign keys `(workspaceId, parentId) → parent(workspaceId, id)` | ADR-0021 |
| Deletes | Soft or hard per entity, as listed in ADR-0022 | ADR-0022 |
| Uniqueness with soft delete | Partial unique indexes `WHERE deleted_at IS NULL` | ADR-0022 |
| Secrets | Tokens stored as `sha256` hashes only | Decision #5, ADR-0022 |
| Limits | Every string has a maximum length in the Zod schema and, where useful, in the column type | RULE.md §5 |

### Entity Relationship Diagram

```
users ──┬──< refresh_tokens
        ├──< user_tokens                       (M6: password reset, email verification)
        ├──< notifications >── workspaces?     (M6)
        │
        └──< workspace_members >── workspaces ──┬──< invitations
                     │                          │
                     │                          ├──< channels ──< messages ──< message_attachments
                     │                          │       │            └──< messages (thread replies)
                     └──────────────< channel_members ──┘
                                                │
                                                └──< boards ──< board_columns ──< tasks >── users (assignee)

Every table right of "workspaces" carries workspaceId (ADR-0021).
```

### Tables

#### users — implemented (M1); changes in M2 and M6
```
id               UUID         PRIMARY KEY
email            VARCHAR(254) NOT NULL, stored lowercase
                              UNIQUE WHERE deleted_at IS NULL            (M2, ADR-0022)
password         VARCHAR      NOT NULL (bcrypt hash)
fullName         VARCHAR(100) NOT NULL
avatarUrl        VARCHAR      NULLABLE (Cloudinary public URL, M4)
isActive         BOOLEAN      DEFAULT true
emailVerifiedAt  TIMESTAMPTZ  NULLABLE                                   (M6, ADR-0029)
lastLoginAt      TIMESTAMPTZ  NULLABLE
deletedAt        TIMESTAMPTZ  NULLABLE (soft delete, Decision #4)
createdAt / updatedAt
```

#### refresh_tokens — implemented (M1)
```
id          UUID        PRIMARY KEY
userId      UUID        FK → users.id, ON DELETE CASCADE
tokenHash   VARCHAR     UNIQUE, NOT NULL (sha256 of the refresh JWT, Decision #5)
expiresAt   TIMESTAMPTZ NOT NULL
createdAt   TIMESTAMPTZ

INDEX: userId · INDEX: expiresAt (daily cleanup)
```

#### user_tokens — M6
```
id           UUID        PRIMARY KEY
userId       UUID        FK → users.id, ON DELETE CASCADE
purpose      ENUM        'RESET_PASSWORD' | 'VERIFY_EMAIL'
tokenHash    VARCHAR     UNIQUE, NOT NULL
expiresAt    TIMESTAMPTZ NOT NULL (reset: 1 h, verify: 24 h)
usedAt       TIMESTAMPTZ NULLABLE (single use)
emailSentAt  TIMESTAMPTZ NULLABLE (ADR-0026 level 3)
createdAt    TIMESTAMPTZ

INDEX: (userId, purpose)
```

#### workspaces — M3
```
id           UUID         PRIMARY KEY
name         VARCHAR(100) NOT NULL (not unique; no slug — URLs use the id, ADR-0034)
description  VARCHAR(500) NULLABLE
logoUrl      VARCHAR      NULLABLE (Cloudinary public URL)
ownerId      UUID         FK → users.id, NOT NULL (exactly one owner, ADR-0032)
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

INDEX: ownerId
```

#### workspace_members — M3
```
id           UUID        PRIMARY KEY
workspaceId  UUID        FK → workspaces.id
userId       UUID        FK → users.id
role         ENUM        'OWNER' | 'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
joinedAt     TIMESTAMPTZ

UNIQUE: (workspaceId, userId)   — also the target of channel_members' composite FK
INDEX: userId
```

#### invitations — M3
```
id            UUID         PRIMARY KEY
workspaceId   UUID         FK → workspaces.id
email         VARCHAR(254) NOT NULL, lowercase
role          ENUM         'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
tokenHash     VARCHAR      UNIQUE, NOT NULL (sha256)
status        ENUM         'PENDING' | 'ACCEPTED' | 'REVOKED'
                           ("expired" = PENDING and expiresAt < now, derived)
invitedById   UUID         FK → users.id
acceptedById  UUID         FK → users.id, NULLABLE
expiresAt     TIMESTAMPTZ  NOT NULL (7 days, reset when the token is rotated)
acceptedAt    TIMESTAMPTZ  NULLABLE
revokedAt     TIMESTAMPTZ  NULLABLE
emailSentAt   TIMESTAMPTZ  NULLABLE (M6)
createdAt / updatedAt

UNIQUE: (workspaceId, email) WHERE status = 'PENDING'          (ADR-0022)
INDEX: workspaceId
```

#### channels — M4
```
id           UUID         PRIMARY KEY
workspaceId  UUID         FK → workspaces.id
name         VARCHAR(80)  NOT NULL
description  VARCHAR(300) NULLABLE
type         ENUM         'PUBLIC' | 'PRIVATE', DEFAULT 'PUBLIC'
isDefault    BOOLEAN      DEFAULT false ("general": cannot be deleted or left)
createdById  UUID         FK → users.id
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

UNIQUE: (workspaceId, id)                                  — composite FK target
UNIQUE: (workspaceId, lower(name)) WHERE deleted_at IS NULL (ADR-0022)
INDEX: workspaceId
```

#### channel_members — M4
```
id           UUID        PRIMARY KEY
workspaceId  UUID        NOT NULL
channelId    UUID        NOT NULL
userId       UUID        NOT NULL
lastReadAt   TIMESTAMPTZ NULLABLE (unread counts, ADR-0024)
joinedAt     TIMESTAMPTZ

FK: (workspaceId, channelId) → channels(workspaceId, id)
FK: (workspaceId, userId)    → workspace_members(workspaceId, userId), ON DELETE CASCADE
    (a channel member is always a workspace member; leaving the workspace removes them)
UNIQUE: (channelId, userId)
INDEX: userId
```

#### messages — M4
```
id               UUID        PRIMARY KEY
workspaceId      UUID        NOT NULL
channelId        UUID        NOT NULL
senderId         UUID        FK → users.id
parentId         UUID        NULLABLE (thread reply; one level only)
content          TEXT        NOT NULL, 1–4,000 characters (ADR-0024)
clientMessageId  UUID        NOT NULL (idempotent send)
replyCount       INTEGER     DEFAULT 0   (maintained in the reply's transaction)
lastReplyAt      TIMESTAMPTZ NULLABLE
editedAt         TIMESTAMPTZ NULLABLE
deletedAt        TIMESTAMPTZ NULLABLE (soft delete)
createdAt / updatedAt

FK: (workspaceId, channelId) → channels(workspaceId, id)
FK: (channelId, parentId)    → messages(channelId, id)   (a reply stays in its channel)
UNIQUE: (workspaceId, id), (channelId, id)                — composite FK targets
UNIQUE: (channelId, senderId, clientMessageId)
INDEX: (channelId, parentId, createdAt, id)               — cursor pagination, threads
```

#### message_attachments — M4
```
id            UUID         PRIMARY KEY
workspaceId   UUID         NOT NULL
messageId     UUID         NOT NULL
publicId      VARCHAR      NOT NULL (Cloudinary, under taskflow/{env}/ws/{workspaceId}/)
resourceType  ENUM         'IMAGE' | 'FILE'
fileName      VARCHAR(255) NOT NULL (sanitized for display)
fileSize      INTEGER      NOT NULL (bytes; images ≤ 5 MB, files ≤ 10 MB)
mimeType      VARCHAR(100) NOT NULL (allow-list, no SVG / HTML)
width, height INTEGER      NULLABLE (images)
createdAt     TIMESTAMPTZ

FK: (workspaceId, messageId) → messages(workspaceId, id)
INDEX: messageId
```

#### boards — M5
```
id           UUID         PRIMARY KEY
workspaceId  UUID         FK → workspaces.id
name         VARCHAR(100) NOT NULL
createdById  UUID         FK → users.id
deletedAt    TIMESTAMPTZ  NULLABLE (soft delete)
createdAt / updatedAt

UNIQUE: (workspaceId, id)
INDEX: workspaceId
```

#### board_columns — M5
```
id           UUID        PRIMARY KEY
workspaceId  UUID        NOT NULL
boardId      UUID        NOT NULL
name         VARCHAR(50) NOT NULL
position     (type decided in M5, ADR-0009; proposal DOUBLE PRECISION, gap 1000)
color        VARCHAR(7)  NULLABLE (#rrggbb)
isDoneColumn BOOLEAN     DEFAULT false (the Done column: tasks in it are Completed;
                         cannot be deleted; see GLOSSARY.md)
createdAt / updatedAt

FK: (workspaceId, boardId) → boards(workspaceId, id)
UNIQUE: (boardId, id)                                      — target for tasks
UNIQUE: (boardId) WHERE is_done_column                     — at most one Done column per board
INDEX: (boardId, position)
```

#### tasks — M5
```
id              UUID         PRIMARY KEY
workspaceId     UUID         NOT NULL
boardId         UUID         NOT NULL (denormalized for board-wide filters)
columnId        UUID         NOT NULL
title           VARCHAR(200) NOT NULL
description     TEXT         NULLABLE, ≤ 10,000 characters
priority        ENUM         'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', DEFAULT 'MEDIUM'
dueDate         TIMESTAMPTZ  NULLABLE
position        (same type as board_columns.position)
assigneeId      UUID         FK → users.id, NULLABLE (must be a workspace member: service rule)
createdById     UUID         FK → users.id
completedAt     TIMESTAMPTZ  NULLABLE (set when the task enters the Done column, cleared
                             when it leaves; never set directly)
reminderSentAt  TIMESTAMPTZ  NULLABLE (ADR-0028)
createdAt / updatedAt

FK: (workspaceId, boardId) → boards(workspaceId, id)
FK: (boardId, columnId)    → board_columns(boardId, id)    (the column belongs to the task's board)
INDEX: (columnId, position) · INDEX: (workspaceId, assigneeId) · INDEX: dueDate
```

#### notifications — M6
```
id             UUID         PRIMARY KEY
userId         UUID         FK → users.id (recipient)
workspaceId    UUID         FK → workspaces.id, NULLABLE
type           ENUM         'TASK_ASSIGNED' | 'TASK_DUE_SOON' | 'MESSAGE_MENTION'
                            | 'INVITATION_RECEIVED' | 'MEMBER_JOINED'
title          VARCHAR(200) NOT NULL
content        VARCHAR(500) NULLABLE
referenceId    UUID         NULLABLE (no FK: polymorphic; the reader handles a deleted target)
referenceType  ENUM         'TASK' | 'MESSAGE' | 'INVITATION' | 'WORKSPACE', NULLABLE
dedupeKey      VARCHAR(200) UNIQUE (makes listeners idempotent, ADR-0026)
readAt         TIMESTAMPTZ  NULLABLE
createdAt      TIMESTAMPTZ

INDEX: (userId, readAt, createdAt) · INDEX: workspaceId
Retention: deleted after 90 days (daily cleanup, ADR-0027)
```

---

## 5. API Design

### Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` (RULE.md §9). In production the browser calls it on the web origin, proxied by Vercel (ADR-0020) |
| Authentication | `Authorization: Bearer <access token>` on every route except `@Public()` ones. The refresh cookie is sent only to `/api/v1/auth/*` |
| Tenant | Workspace routes are nested under `/workspaces/:workspaceId`. The id comes **only** from the URL (RULE.md §5) |
| Ids and times | UUIDs; ISO 8601 UTC strings (`…Z`) |
| Offset lists | `?page=1&limit=20` (`limit` ≤ 100) → `meta: { total, page, limit, totalPages }` |
| Cursor lists | `?before=<cursor>` or `?after=<cursor>` and `limit` (≤ 50) → `meta: { nextCursor, hasMore }`. Cursors are opaque strings |
| Status codes | 200 OK, 201 created, 204 deleted / no content, 400 validation or business rule, 401 not authenticated, 403 not allowed, 404 not found (also for resources of another tenant), 409 conflict, 429 rate limited |
| Headers | `X-Request-Id` on every response; `Retry-After` on 429; `Cache-Control: no-store` on every response (ADR-0019) |
| Contract | `apps/api/openapi.json`, generated and committed; the frontend client is generated from it (ADR-0033) |

### Standard Response Format

```json
// Success (single item)
{ "success": true, "data": { ... } }

// Success (offset list)
{ "success": true, "data": [ ... ], "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 } }

// Success (cursor list)
{ "success": true, "data": [ ... ], "meta": { "nextCursor": "eyJj…", "hasMore": true } }

// Error (Decision #1)
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human readable message",
  "details": [ { "field": "email", "message": "Invalid email format" } ],
  "timestamp": "2026-01-01T00:00:00.000Z",
  "requestId": "6f1c…"
}
```

### Endpoint List

#### Health — `/api/v1/health` (M1, M2)
```
GET    /                      Liveness. No database, no Redis (keep-alive target)      @Public
GET    /ready                 Readiness: database + Redis (M2, ADR-0035)                @Public
```

#### Auth — `/api/v1/auth`
```
POST   /register              Register; returns access token, sets refresh cookie       @Public  M1
POST   /login                 Login; same response                                      @Public  M1
POST   /refresh               Rotate refresh cookie, return new access token            @Public  M1  (Origin check, M2)
POST   /logout                Delete the session, clear the cookie                      @Public  M1  (Origin check, M2)
GET    /me                    Current user                                                       M1
POST   /forgot-password       Send a reset email (same response whether or not the
                              email exists)                                             @Public  M6
POST   /reset-password        Reset with token; revokes all sessions                    @Public  M6
POST   /verify-email          Verify with token                                         @Public  M6
POST   /resend-verification   Send the verification email again                                  M6
```

#### Users — `/api/v1/users`
```
PATCH  /profile               Update full name                                                   M1
PATCH  /password              Change password (current password required);
                              revokes other sessions                                             M1
POST   /avatar/signature      Cloudinary upload signature for an avatar                          M4
PATCH  /avatar                Save the uploaded avatar (verified Cloudinary response)            M4
```

#### Workspaces — `/api/v1/workspaces` (M3)
```
GET    /                                  Workspaces I belong to (paginated)
POST   /                                  Create (I become OWNER)
GET    /:workspaceId                      Details
PATCH  /:workspaceId                      Update name, description, logo (OWNER, ADMIN)
DELETE /:workspaceId                      Soft delete (OWNER)
POST   /:workspaceId/transfer-ownership   Make another member OWNER (OWNER)
POST   /:workspaceId/uploads/signature    Upload signature: attachment | workspace-logo  (M4)
```

#### Workspace Members — `/api/v1/workspaces/:workspaceId/members` (M3)
```
GET    /                      List members (paginated; includes `online`, M4)
PATCH  /:memberId/role        Change role (OWNER: anyone but self; ADMIN: MEMBERs only)
DELETE /:memberId             Remove member (same rule)
POST   /leave                 Leave (not the OWNER)
```

#### Invitations — `/api/v1/workspaces/:workspaceId/invitations` (M3)
```
GET    /                      Pending invitations (ADMIN+, paginated)
POST   /                      Invite { email, role }; re-inviting rotates the token
                              (ADMIN+; 20/day per workspace). Returns the link once
DELETE /:invitationId         Revoke (ADMIN+)
```

#### Invitations, invitee side — `/api/v1/invitations` (M3)
```
POST   /preview               { token } → workspace name, inviter, email, status   @Public (rate limited)
POST   /accept                { token } → join the workspace (email must match; verified from M6)
```

#### Channels — `/api/v1/workspaces/:workspaceId/channels` (M4)
```
GET    /                      Channels I can see (public + private where I am a member)
GET    /unread-counts         Unread count per channel, one query (ADR-0024)
POST   /                      Create channel
GET    /:channelId            Details
PATCH  /:channelId            Update name, description (creator or ADMIN+)
DELETE /:channelId            Soft delete (ADMIN+; not "general")
POST   /:channelId/join       Join a public channel
POST   /:channelId/leave      Leave (not "general")
GET    /:channelId/members    List channel members
POST   /:channelId/members    Add a member to a private channel (channel member or ADMIN+)
DELETE /:channelId/members/:userId   Remove from a private channel
POST   /:channelId/read       Mark as read (sets lastReadAt)
```

#### Messages — `/api/v1/workspaces/:workspaceId/channels/:channelId/messages` (M4)
```
GET    /                      Top-level messages, ?before= / ?after= cursors
POST   /                      Send { content, clientMessageId, parentId?, attachments? }
                              (idempotent; 10 / 10 s per user)
PATCH  /:messageId            Edit own message
DELETE /:messageId            Soft delete (sender or ADMIN+)
GET    /:messageId/thread     Replies, same cursor rules
```

#### Boards — `/api/v1/workspaces/:workspaceId/boards` (M5)
```
GET    /                      List boards (paginated)
POST   /                      Create board (default columns: Todo, In Progress, Done)
GET    /:boardId              Board with columns and up to 500 tasks
PATCH  /:boardId              Rename
DELETE /:boardId              Soft delete (ADMIN+)
```

#### Board Columns — `/api/v1/workspaces/:workspaceId/boards/:boardId/columns` (M5)
```
POST   /                      Create column
PATCH  /reorder               Reorder { columnIds: [...] } (declared before /:columnId)
PATCH  /:columnId             Update name, color
DELETE /:columnId             Delete (only when empty)
```

#### Tasks — `/api/v1/workspaces/:workspaceId/boards/:boardId/tasks` (M5)
```
GET    /                      List; filters columnId, assigneeId, priority, dueFrom, dueTo (paginated)
POST   /                      Create task
GET    /:taskId               Details
PATCH  /:taskId               Update title, description, priority, dueDate
                              (completion follows the Done column, see /move)
DELETE /:taskId               Delete
PATCH  /:taskId/move          Move { columnId, beforeTaskId?, afterTaskId? }; the server
                              computes the position from the neighbours (ADR-0009)
PATCH  /:taskId/assign        Assign { assigneeId } or unassign { assigneeId: null }
```

#### Notifications — `/api/v1/notifications` (M6)
```
GET    /                      My notifications (paginated)
GET    /unread-count          Unread count
PATCH  /read-all              Mark all as read
PATCH  /:notificationId/read  Mark one as read
```

### WebSocket Events

Full rules in ADR-0025. Payloads are `{ workspaceId, occurredAt, data }`, where `data` is the REST response DTO of the resource.

| Direction | Event | Room | Data | Milestone |
|---|---|---|---|---|
| C → S | `workspace:join` | — | `{ workspaceId }` (ack) | M4 |
| C → S | `board:join`, `board:leave` | — | `{ workspaceId, boardId }` (ack) | M5 |
| C → S | `typing:start`, `typing:stop` | — | `{ workspaceId, channelId }` (ack) | M4 |
| S → C | `message:created`, `message:updated` | `channel:{id}` | Message | M4 |
| S → C | `message:deleted` | `channel:{id}` | `{ id, channelId, parentId }` | M4 |
| S → C | `typing:started`, `typing:stopped` | `channel:{id}` | `{ channelId, userId, fullName }` | M4 |
| S → C | `channel:created`, `channel:updated`, `channel:deleted` | `workspace:{id}` (public) or `channel:{id}` + user rooms (private) | Channel | M4 |
| S → C | `channel:removed` | `user:{id}` | `{ channelId }` | M4 |
| S → C | `member:joined`, `member:left`, `member:role-changed` | `workspace:{id}` | Member | M4 |
| S → C | `presence:online`, `presence:offline` | `workspace:{id}` | `{ userId }` | M4 |
| S → C | `workspace:removed` | `user:{id}` | `{ workspaceId }` | M4 |
| S → C | `task:created`, `task:updated`, `task:moved` | `board:{id}` | Task | M5 |
| S → C | `task:deleted` | `board:{id}` | `{ id, columnId }` | M5 |
| S → C | `column:created`, `column:updated`, `column:deleted`, `columns:reordered` | `board:{id}` | Column / `{ columnIds }` | M5 |
| S → C | `notification:created` | `user:{id}` | Notification | M6 |
| S → C | `exception` | the socket | Error shape of Decision #1 | M4 |

---

## 6. Feature Specifications

### Feature 1: Authentication (M1; M2 hardening; M6 email flows)

**Register**
- Input: email (trimmed, lowercased), password (≥ 8 characters, one uppercase letter, one digit, ≤ 72 bytes), fullName.
- Email must not belong to a non-deleted user → otherwise 409.
- Hash with bcryptjs, cost 10 (Decision #6). Create the user.
- Issue an access token (15 min) and a refresh token (7 days); store `sha256(refresh)`; refresh token only in the httpOnly cookie (Decision #5).
- M6: send the verification email (`user_tokens`, level-3 email, ADR-0026).

**Login**
- Same response for an unknown email and a wrong password: 401 "invalid credentials".
- A blocked or deleted user cannot sign in (`canSignIn`).
- Rate limited (ADR-0031).

**Refresh** (rotation with reuse detection)
- Read the cookie (Origin must be `FRONTEND_URL`, ADR-0020). Verify the JWT, then delete its hash.
- Deleted 1 row → issue a new pair. Deleted 0 rows → the token was already used: **revoke every session** of the user, 401, clear the cookie.

**Logout**
- Delete the session, clear the cookie. The client clears its memory, caches and socket.

**Password reset and email verification (M6)**
- Single-use hashed tokens in `user_tokens`; reset tokens expire after 1 h, verification after 24 h.
- `forgot-password` answers the same way whether or not the email exists.
- A successful reset revokes every session.

### Feature 2: Workspaces, Members, Invitations (M3)

**Create workspace**
- Input: name (1–100 characters, not unique), optional description. There is no slug: URLs use the workspace id (ADR-0034).
- One transaction: workspace + OWNER member. After commit: `workspace.created` (M4 creates "general" from it).

**WorkspaceGuard (every workspace route)**
```
1. workspaceId from the URL params only
2. Find the membership (workspaceId, userId) where the workspace is not deleted
3. Not found → 404 (do not reveal that the workspace exists)
4. Attach workspaceId and role to the request; check @WorkspaceRoles(...)
5. Repositories filter tenant data by this workspaceId (ADR-0021)
```

**Role matrix**

| Action | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Update workspace | ✅ | ✅ | ❌ |
| Delete workspace, transfer ownership | ✅ | ❌ | ❌ |
| Invite, revoke invitations | ✅ | ✅ | ❌ |
| Change role / remove an ADMIN | ✅ | ❌ | ❌ |
| Change role / remove a MEMBER | ✅ | ✅ | ❌ |
| Leave | ❌ (transfer first) | ✅ | ✅ |
| Delete any channel / board, delete others' messages | ✅ | ✅ | ❌ |

**Ownership transfer:** the Owner picks another Member; in one transaction that Member becomes OWNER and the previous Owner becomes ADMIN (ADR-0032).

**Invitations:** lifecycle in ADR-0022, accept rules in ADR-0032, flow in §3 "Critical Flows 3". Leaving or being removed unassigns the member's tasks and removes their channel memberships (cascade).

**Blocked and deleted Users** are operator actions in the database, with no screen (see `GLOSSARY.md`). A deleted User is removed from every Workspace; their Messages stay and are shown under "Deleted user". The operator transfers ownership first if the User is an Owner.

Vocabulary for this feature and the next ones: [`GLOSSARY.md`](GLOSSARY.md).

### Feature 3: Channels & Messaging (M4)

**Channels**
- Every workspace has a default public channel "general" (`isDefault`): every member is in it; it cannot be deleted or left.
- Public channels: any member can see and join. Private channels: visible only to their members; members are added by a channel member or ADMIN+.

**Send message**
- REST only. Validate: channel membership, content 1–4,000 characters, mentions limited to channel members, ≤ 5 attachments (verified uploads, ADR-0030).
- One transaction: insert (idempotent by `clientMessageId`), update the parent's `replyCount` / `lastReplyAt` for a reply.
- After commit: `message.created` → socket event to `channel:{id}`; M6: mention notifications.

**Load messages:** cursor pagination `(createdAt, id)`; `before` to scroll up, `after` to resync (ADR-0024). Offset pagination is not used here because new messages shift pages.

**Unread:** `lastReadAt` per channel member; the sidebar loads all counts in one query; opening a channel marks it read.

**Typing and presence:** ADR-0025 (server-side identity, throttling, 5 s auto-stop, 10 s offline grace).

**Attachments:** signed direct upload, private delivery for attachments (ADR-0030).

### Feature 4: Kanban Board (M5)

**Positioning:** decided at the start of M5 (ADR-0009; proposal: gap-based floating positions with rebalancing). The client sends the neighbours (`beforeTaskId`, `afterTaskId`); the server computes the position in one locking transaction, so two concurrent moves cannot produce equal positions.

**Assignment:** the assignee must be a workspace member. Changing the assignee or the due date resets `reminderSentAt`. After commit: `task.assigned`.

**Completion follows the Done column:** each Board has exactly one Done column (`isDoneColumn`; on a new Board it is "Done"). A Task created in or moved into it gets `completedAt = now`; moved out, `completedAt` is cleared. The Done column can be renamed but not deleted; choosing a different column as the Done column is not supported yet. This keeps the board and the reminders consistent: a Task dragged to Done is never reminded about.

**Reminders:** hourly scan, 23–24 h before the deadline, once per due date (ADR-0028).

**Filters:** assignee, priority, due range, column; offset pagination.

### Feature 5: Notifications (M6)

**Types and triggers** (each created by a listener, idempotent through `dedupeKey`)
```
TASK_ASSIGNED       ← task.assigned                  to the assignee (not when self-assigned)
TASK_DUE_SOON       ← hourly reminders.scan          to the assignee
MESSAGE_MENTION     ← message.created with mentions  to mentioned channel members
INVITATION_RECEIVED ← invitation.created             to the invitee, if they already have an account
MEMBER_JOINED       ← member.joined                  to OWNER and ADMINs
```

**Delivery**
- In app: row + `notification:created` to `user:{id}` (best effort, ADR-0026 level 2).
- Email: invitations (to the address, level 3), deadline reminders (best effort with retries), account emails (level 3).
- Retention: 90 days.

---

## 7. Milestones & Timeline

> Re-planned on 2026-11-21 as vertical slices (ADR-0037). The previous plan built the backend for four milestones, the frontend after, and deployed last.

### Planning rules

1. **Vertical slice.** Every milestone delivers backend + frontend + tests for its features and ends **deployed to production and usable in a browser**.
2. **Only backward dependencies.** A milestone uses only what earlier milestones built. If a feature needs a later milestone, it moves there, or the earlier milestone publishes a domain event that the later one subscribes to (ADR-0026).
3. **Read first.** Each milestone lists the ADRs to read before its spec. They are binding.
4. **One branch = one Development Flow** (RULE.md §0): spec → plan → tasks in `docs/specs|plans|tasks/<branch>.md`, then code, tests, checks, PR.
5. **Completion criteria are checked in production** from M2 on, not only in tests.
6. **"Not in this milestone"** lists what is deliberately postponed and where it goes, so nothing is forgotten.
7. **UI bar:** functional and consistent, with loading, empty and error states on every new screen. Visual polish and the full responsive pass happen in M7 (ADR-0034).

### Overview

| # | Milestone | Weeks | Deployed result |
|---|---|---|---|
| M1 | Foundation & Auth API | 1–2 | ✅ Done (API only, local) |
| M2 | Web foundation, auth UI, production walking skeleton | 3–4 | Register / login / profile on the live URL |
| M3 | Workspaces, members, invitations | 5–6 | Create a workspace, invite by link, manage roles |
| M4 | Channels, real-time messaging, uploads | 7–9 | Live chat with threads, attachments, presence |
| M5 | Kanban boards | 10–11 | Live drag-and-drop boards |
| M6 | Notifications, email, background jobs | 12–13 | Notifications, invitation and reminder emails, password reset |
| M7 | Hardening, polish & launch | 14–15 | Measured, audited, documented, demo-ready |

The total grows from 13 to 15 weeks: the frontend and deployment work is now spread over every milestone instead of being estimated once at the end, and M2 front-loads the integration risks.

---

### Milestone 1: Foundation & Auth API (Weeks 1–2) — ✅ Done

**Goal:** a user can register, log in, refresh and revoke sessions, and manage their profile through the API.

Delivered: pnpm monorepo, NestJS strict, Prisma 7 with `users` + `refresh_tokens`, Docker Compose (dev + test databases, Redis), Zod env config, global exception filter, response interceptor, Zod validation pipe, Swagger at `/api/docs`, health endpoint, auth module (register, login, refresh with rotation and reuse detection, logout, me), global JWT guard, users module (profile, password), unit + integration tests.

Decisions: ADR-0001 … ADR-0017.

---

### Milestone 2: Web Foundation, Auth UI & Production Walking Skeleton (Weeks 3–4)

**Goal:** the auth features of M1 work end to end **on the production URLs**, and every integration risk listed in §3 "Risks to verify" has been measured.

**Depends on:** M1.
**Read first:** ADR-0006, 0019, 0020, 0023, 0031, 0033, 0034, 0035, 0036.

**Branch `chore/api-production-readiness`** (API, before it becomes public)
```
2.1  Schema conventions migration: every DateTime → timestamptz(3) USING … AT TIME ZONE 'UTC'
     (ADR-0023); users.email unique only WHERE deleted_at IS NULL (ADR-0022)
2.2  prisma7.config.ts reads DIRECT_DATABASE_URL, falls back to DATABASE_URL (ADR-0036)
2.3  Refresh cookie SameSite=Lax; Origin check on /auth/refresh and /auth/logout (ADR-0020)
2.4  trust proxy (TRUST_PROXY env); Cache-Control: no-store on every response (ADR-0019, 0020)
2.5  Rate limiting with @nestjs/throttler, M2 rows of ADR-0031
2.6  nestjs-pino JSON logs, X-Request-Id, requestId in error bodies (ADR-0035)
2.7  GET /health/ready (database + Redis); /health stays dependency-free (ADR-0035)
2.8  openapi:export script; apps/api/openapi.json committed (ADR-0033)
2.9  Tests for each item (429, Origin 403, requestId, timestamptz round trip)
2.9b Wording: "account" → "User" in comments and Swagger descriptions (GLOSSARY.md)
```

**Branch `feature/web-foundation`**
```
2.10 Vite + React + TypeScript strict, ESLint, Vitest; folder structure of RULE.md §11
2.11 Tailwind + base tokens (colors, spacing, typography); app shell and public layout
2.12 React Router: public routes, protected routes, not-found page
2.13 Generated API client + TanStack Query hooks from openapi.json (proposal: orval)
2.14 HTTP client: credentials, single-flight refresh on 401, retry once (ADR-0034)
2.15 Auth store: access token in memory only; session restore on boot
2.16 Vite proxy /api → localhost:3000 (ADR-0020); error boundary; toast notifications
```

**Branch `feature/web-auth`**
```
2.17 Pages: Login, Register, Profile (edit name), Change password, Logout
2.18 Form validation with generated Zod schemas; server errors mapped to fields
2.19 Component tests for forms and the refresh flow
```

**Branch `chore/deploy-pipeline`**
```
2.20 Neon project (Singapore): pooled + direct URLs
2.21 Render web service (Singapore): env vars, health check path /api/v1/health,
     auto-deploy off + deploy hook; Render Key Value (Singapore)
2.22 Vercel project: vercel.json rewrites /api → Render, security headers + CSP,
     preview deployments disabled
2.23 GitHub Actions: PR pipeline and main pipeline (migrate deploy → deploy hook) (ADR-0036)
2.24 Dependabot; UptimeRobot on /health every 5 min; Sentry for API and web (ADR-0035)
2.25 Verify the §3 risks and record the results in §3:
     login latency (bcryptjs on 0.1 CPU), cookie through the proxy (Chrome + Safari),
     trust proxy value (real client IP in logs), Neon pooled endpoint with adapter-pg
```

**Completion criteria (on production):**
- [ ] Register, log in, reload the page and stay logged in, in Chrome **and Safari**
- [ ] Edit profile, change password (other sessions are revoked), log out
- [ ] 6th rapid login attempt returns 429 with `Retry-After`
- [ ] An error response's `requestId` can be found in the Render logs
- [ ] Merging to `main` runs CI, the migration and the deploy without manual steps
- [ ] Login p95 measured and written in §3 (switch to native `bcrypt` if > 1.5 s, Decision #6)

**Not in this milestone:** forgot/reset password and email verification → M6. Visual polish → M7.

---

### Milestone 3: Workspaces, Members & Invitations (Weeks 5–6)

**Goal:** users create workspaces, invite people by link, and manage roles. Tenant isolation is proven by tests.

**Depends on:** M1, M2.
**Read first:** ADR-0021, 0022, 0026, 0031, 0032. First task: check whether Prisma 7.10 supports partial indexes in the schema (ADR-0022).

**Branch `feature/workspaces`**
```
3.1  Schema: workspaces, workspace_members (composite keys, ADR-0021; no slug)
3.2  WorkspaceGuard: membership + workspace not deleted; attaches workspaceId and role
3.3  Decorators: @CurrentWorkspace(), @WorkspaceRoles(...)
3.4  CRUD: list mine, create, get, update, soft delete
3.5  Transfer ownership: new Owner → OWNER, previous Owner → ADMIN (ADR-0032);
     domain event workspace.created
3.6  Web: workspace list / switcher, create dialog, settings page, delete (owner)
```

**Branch `feature/workspace-members`**
```
3.7  List (paginated), change role, remove, leave — role rules of ADR-0032
3.8  Domain events member.joined, member.left, member.removed
3.9  Web: members page with role actions
```

**Branch `feature/invitations`**
```
3.10 Schema: invitations (tokenHash, status PENDING/ACCEPTED/REVOKED, partial unique pending)
3.11 Create (ADMIN+, returns the link once; 20/day per workspace), list pending,
     revoke, re-invite rotates the token (ADR-0022)
3.12 POST /invitations/accept { token }: authenticated, email must match, atomic (ADR-0032)
3.13 Domain event invitation.created (M6 subscribes for the email)
3.14 Web: invite dialog with "copy link", pending list, /invite?token=… page
     (login or register first, token removed from the address bar, then accept)
```

**Tests (in addition to unit and endpoint tests):**
- Isolation suite: a member of workspace A gets 404 on **every** workspace-B endpoint (read and write), never data (ADR-0021)
- Concurrency: double accept, two transfers of ownership at once (ADR-0032)
- Role matrix: OWNER / ADMIN / MEMBER × every member and invitation action

**Completion criteria (on production):**
- [ ] Create a workspace, copy an invite link, a second account accepts it, both see each other in members
- [ ] A MEMBER cannot invite (403); an outsider gets 404 on every URL of the workspace
- [ ] Expired and revoked links show a clear message; accepting with another email is refused
- [ ] Ownership can be transferred; the owner cannot leave before transferring

**Not in this milestone:** invitation email → M6 (event already published). "general" channel → M4 (with a backfill for existing workspaces).

---

### Milestone 4: Channels, Real-time Messaging & Uploads (Weeks 7–9)

**Goal:** members chat in real time in public and private channels, with threads, attachments and presence. Missed events are recovered after a reconnect.

**Depends on:** M1–M3.
**Read first:** ADR-0024, 0025, 0026, 0030, 0031.

**Branch `feature/channels`**
```
4.1  Schema: channels (isDefault), channel_members (workspaceId, lastReadAt)
4.2  CRUD; join / leave public; add / remove members of private channels; soft delete (ADMIN+)
4.3  "general": created on workspace.created (listener), idempotent ensureDefaultChannel,
     data migration for workspaces created in M3; new members join it (member.joined)
4.4  POST …/channels/:id/read; unread counts for the whole sidebar in one query (ADR-0024)
4.5  Web: sidebar with unread badges, create channel, browse and join public channels,
     private channel members
```

**Branch `feature/messages`**
```
4.6  Schema: messages (workspaceId, clientMessageId, replyCount, lastReplyAt, editedAt)
4.7  List with before/after cursors, send (idempotent), edit and soft delete own
     (ADMIN may delete any), thread list; mention tokens limited to channel members
4.8  Rate limit 10 messages / 10 s per user; domain events message.created|updated|deleted
4.9  Web: message list with infinite scroll upwards, composer with optimistic send,
     edit / delete, thread panel, mention picker
```

**Branch `feature/realtime-gateway`**
```
4.10 Gateway: handshake auth, disconnect at token expiry, forced disconnect on
     session revocation (event from users/auth) (ADR-0025)
4.11 Rooms user / workspace / channel with authorization; leave rooms on removal
4.12 Listeners: message, channel and member events → socket events (envelope + DTO)
4.13 Typing (throttled, server-side timeout); presence (PresenceStore, 10 s grace)
4.14 Acks and error shape; 20 events / 10 s per socket
4.15 Web: realtime module (connect with token, reconnect with a fresh token, resync,
     cache updates), typing indicator, presence dots
```

**Branch `feature/uploads`**
```
4.16 Signature endpoints; verification of the Cloudinary response; folder per tenant (ADR-0030)
4.17 Schema: message_attachments; signed delivery URLs for attachments
4.18 Avatar and workspace logo (public)
4.19 Web: attach files in the composer with previews; avatar in profile; logo in settings
```

**Tests:**
- Socket integration (real app + `socket.io-client`): cannot join another tenant's workspace; a non-member receives nothing from a private channel; a removed member stops receiving; an expired token is disconnected
- Cursor pagination stays stable while messages are inserted; idempotent send; unread counts

**Completion criteria (on production):**
- [ ] Two browsers: a message appears on the other side in < 500 ms; typing and presence work
- [ ] A private channel is invisible to non-members, in the UI and on the socket
- [ ] Cut the network for 30 s, reconnect: the missed messages appear without a reload
- [ ] Clicking "send" twice on a slow network creates one message
- [ ] An attachment URL from a private channel does not work without its signature

**Not in this milestone:** @mention notifications → M6 (subscribes to `message.created`). Orphan upload cleanup → M7 stretch.

---

### Milestone 5: Kanban Boards (Weeks 10–11)

**Goal:** members manage tasks on boards with real-time drag and drop.

**Depends on:** M1–M4 (real-time gateway).
**Read first:** ADR-0009 (decide the `position` type first), 0021, 0025, 0026, 0032.

**Branch `feature/boards`**
```
5.1  Schema: boards, board_columns (workspaceId)
5.2  Board CRUD (soft delete ADMIN+), default columns (Todo, In Progress, Done);
     "Done" is the board's Done column (isDoneColumn, cannot be deleted)
5.3  Column CRUD (delete only when empty) and reorder
5.4  Web: board list, board page with columns
```

**Branch `feature/tasks`**
```
5.5  Schema: tasks (workspaceId, boardId, composite FK to column, dueDate timestamptz,
     reminderSentAt) (ADR-0021, 0028)
5.6  CRUD; move with positions and rebalancing in one locking transaction (ADR-0009);
     entering / leaving the Done column sets / clears completedAt
5.7  Assign / unassign (assignee must be a member) → domain event task.assigned
5.8  Filters: assignee, priority, due range (offset pagination); changing dueDate or
     assignee resets reminderSentAt
5.9  Web: drag and drop (dnd-kit), task drawer, filters, assignee and due-date pickers
```

**Branch `feature/board-realtime`**
```
5.10 Board rooms (board:join / board:leave) with authorization
5.11 task:* and column:* events; web cache updates
```

**Tests:** move and reorder (including two concurrent moves), rebalancing, a task cannot reference a column of another board or workspace (composite FK), filters.

**Completion criteria (on production):**
- [ ] Two browsers see each other's drag and drop live; the order survives a reload
- [ ] Filters work; assigning a task publishes `task.assigned` (visible in the logs)

**Not in this milestone:** assignment notification and deadline reminder → M6.

---

### Milestone 6: Notifications, Email & Background Jobs (Weeks 12–13)

**Goal:** users get in-app and email notifications; password reset and email verification work; periodic work runs within the free-tier budgets.

**Depends on:** M1–M5.
**Read first:** ADR-0016, 0026, 0027, 0028, 0029. **Decide first:** the domain question of ADR-0029.

**Branch `feature/notifications`**
```
6.1  Schema: notifications
6.2  Listeners: task.assigned → TASK_ASSIGNED; message.created mentions → MESSAGE_MENTION;
     member.joined → MEMBER_JOINED (admins); invitation.created → INVITATION_RECEIVED
     (if the invitee has an account). All idempotent
6.3  List (paginated), unread count, mark read, mark all read; notification:created to user room
6.4  Web: bell with unread badge, dropdown, notifications page
```

**Branch `feature/jobs-and-mail`**
```
6.5  BullMQ: email and maintenance queues, worker options, graceful shutdown (ADR-0027)
6.6  MailService port: Resend adapter, SMTP → Mailpit adapter (+ docker-compose service),
     test fake (ADR-0029)
6.7  Invitation email (invitations.emailSentAt + deterministic jobId); hourly email.sweep
6.8  Hourly tick at :00: reminders.scan (ADR-0028), email.sweep; daily cleanup
6.9  /health/ready includes Redis; daily email quota guard
```

**Branch `feature/password-reset-and-verification`**
```
6.10 Forgot / reset password: hashed single-use token, 1 h expiry, revokes all sessions
6.11 Email verification: emailVerifiedAt, verification email, resend link; accepting
     an invitation now requires a verified email
6.12 Web: forgot password, reset password, verify-email banner and page
```

**Tests:** listener idempotency; reminder window boundaries and no duplicates; reset on due-date change; the sweep re-enqueues unsent emails; HTTP still works when the queue is unavailable.

**Completion criteria (on production):**
- [ ] An invitation email arrives and its link works
- [ ] Assigning a task shows a notification live; a reminder email arrives 23–24 h before the deadline
- [ ] Restarting Render Key Value loses nothing (at most one hour of email delay)
- [ ] Forgot password → email → reset → old sessions are logged out
- [ ] After one week, Neon compute and Resend usage are within the §3 budget

---

### Milestone 7: Hardening, Polish & Launch (Weeks 14–15)

**Goal:** the live application meets the §3 targets, passes the security checklist, and is presented properly.

**Depends on:** M1–M6.

**Branch `chore/security-audit`**
```
7.1  Checklist: every route guarded or @Public; every tenant query has workspaceId;
     no sensitive field in any response or event; errors do not leak internals;
     socket rooms authorized; rate limits in place (RULE.md §5)
7.2  passwordChangedAt: reject access tokens issued before a password change (Decision #17)
```

**Branch `chore/performance`**
```
7.3  N+1 review from query logs; an index for every WHERE / ORDER BY (RULE.md §4)
7.4  Measure §3 targets from production logs; small k6 load test at the design target
     on a local stack; deviations explained in an ADR
```

**Branch `chore/ux-polish`**
```
7.5  Responsive pass (mobile), accessibility basics (labels, focus, contrast)
7.6  Playwright E2E for the critical flows (auth, workspace, invite, message, move task) in CI
```

**Branch `docs/launch`**
```
7.7  seed:demo run once on production (demo account + workspace)
7.8  README: description, live link, screenshots / GIF, architecture diagram, NFR table,
     ADR highlights, how to run locally, how to run tests
```

**Stretch (only if time remains):** self-service account deletion (password confirmation; refused while the User is an Owner), audit log of admin actions, orphan upload cleanup, PostgreSQL Row-Level Security (ADR-0021), Socket.io Redis adapter (ADR-0018 scale path).

**Completion criteria:**
- [ ] Every §3 target measured and written down (or the deviation explained in an ADR)
- [ ] Security checklist complete; Playwright suite green in CI
- [ ] README complete; a recruiter can log in as the demo user and see real content

---

## 8. Deployment Plan

### Local Development

Infrastructure runs in Docker, the API and the web app run on the host (Decision #3).

```
docker compose up -d       postgres (5432), postgres-test (5433, tmpfs), redis (6379)
                           + mailpit (SMTP 1025, web UI 8025) from M6 (ADR-0029)
pnpm --filter api db:migrate
pnpm dev                   API on :3000 (watch); from M2 also the web app on :5173
```

The Vite dev server proxies `/api` to `localhost:3000`, so local development has the same single-origin setup as production (ADR-0020). Copy `.env.example` to `.env` and `.env.test`.

### Production Architecture

```
Pull request ──► GitHub Actions: lint → typecheck → unit → integration + E2E
                 (Postgres + Redis service containers) → openapi.json up to date → web build

Merge to main ─► same checks ─► prisma migrate deploy (DIRECT_DATABASE_URL, Neon)
                              ─► Render deploy hook (auto-deploy OFF: code never runs
                                 before its migration)
              ─► Vercel builds and deploys the web app from main (preview deployments OFF)

Browser ─► Vercel (static + /api/* rewrite) ─► Render web service ─► Neon (pooled)
        ─► Render web service directly for the WebSocket                 Render Key Value
                                                                         Cloudinary · Resend · Sentry
UptimeRobot ─► GET /api/v1/health every 5 min (keeps Render awake; never touches the database)
```

Migrations follow expand → migrate → contract (ADR-0036): every migration must work with the code that is already deployed.

### Services

| Service | Settings |
|---|---|
| Render web service | Region Singapore. Build `pnpm install --frozen-lockfile && pnpm --filter api build`. Start `pnpm --filter api start`. Health check path `/api/v1/health`. Auto-deploy off; deploy hook stored as a GitHub secret |
| Render Key Value | Region Singapore (same as the web service). Internal URL as `REDIS_URL`. Free plan: in-memory only (ADR-0027) |
| Neon | Region `ap-southeast-1` (Singapore). Pooled URL → `DATABASE_URL`; direct URL → `DIRECT_DATABASE_URL` (CI secret and Render) |
| Vercel | Root `apps/web`. `vercel.json`: rewrite `/api/:path*` → `https://<render-service>.onrender.com/api/:path*`, SPA fallback to `index.html`, security headers + CSP. Preview deployments disabled |
| Cloudinary | Folders `taskflow/{env}/…`; attachments uploaded as `authenticated` (ADR-0030) |
| Resend | Verified sending domain (ADR-0029 open question) |
| Sentry | Projects for API and web; DSNs as env vars |
| UptimeRobot | HTTP monitor on `/api/v1/health`, 5-minute interval, email alerts |

### Environment Variables (production)

```
# API (Render)
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
TRUST_PROXY=<value verified in M2>          # ADR-0020: number of proxy hops (Vercel → Render)

DATABASE_URL=postgresql://…-pooler…/taskflow?sslmode=require     # runtime, pooled
DIRECT_DATABASE_URL=postgresql://…/taskflow?sslmode=require      # Prisma CLI only

REDIS_URL=redis://red-…:6379                # Render Key Value internal URL

JWT_ACCESS_SECRET=<random, ≥ 32 chars>
JWT_REFRESH_SECRET=<different random, ≥ 32 chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

FRONTEND_URL=https://<app>.vercel.app       # Origin check, socket CORS, links in emails

CLOUDINARY_CLOUD_NAME=…                     # M4
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…

MAIL_PROVIDER=resend                        # M6 (smtp locally → Mailpit)
MAIL_FROM=TaskFlow <no-reply@<domain>>
RESEND_API_KEY=…

SENTRY_DSN=…

# Web (Vercel, build time)
VITE_SOCKET_URL=https://<render-service>.onrender.com   # WebSocket goes direct (ADR-0020)
VITE_SENTRY_DSN=…
```

No `BACKEND_URL` (email links point to the frontend) and no SMTP settings in production (ADR-0029). `.env.example` lists every key with a safe placeholder.

### Free-Tier Limits

Verified limits, budgets and the risks still to measure are in §3 "Non-Functional Requirements & Capacity Budget". Summary of the operational rules that follow from them:

- Exactly one always-on Render service (750 h/month): API, gateway and workers in one process.
- Render sleeps after 15 minutes without traffic and takes ~1 minute to wake: UptimeRobot pings `/health` every 5 minutes. `/health` never touches the database, so Neon can still scale to zero.
- Periodic jobs run at most hourly, all at minute :00, so Neon wakes once per hour.
- Redis may be wiped at any time: nothing lives only in Redis.

---

## 9. How to Work on This Project

### For the Human Developer

```
1. Open the current milestone in §7 and CLAUDE.md "Current Milestone"
2. Read the ADRs listed under "Read first"
3. For each branch, follow RULE.md §0:
   a. Spec   → docs/specs/<branch>.md   (scope, inputs/outputs, edge cases, acceptance criteria)
   b. Plan   → docs/plans/<branch>.md   (data flow, files, schemas, dependencies, decisions,
                                         seams under test)
   c. Tasks  → docs/tasks/<branch>.md   (small vertical slices, one commit each, ⚠️ parts marked)
   d. Per task: failing test → minimal code → green; full test run; review; refactor
   e. Update docs (CLAUDE.md status, ADR index, WORKFLOW.md + WORKFLOW-VI.md if changed)
   f. PR: lint, typecheck, all tests green
4. Check the milestone's completion criteria on production, then move on
```

### For AI Assistants

```
Before generating ANY code:
1. Read CLAUDE.md (entry point), then RULE.md
2. Read the ADRs listed for the current milestone and the WORKFLOW.md sections of the feature
3. Check what already exists in the code; never duplicate
4. If a request conflicts with an ADR, RULE.md or this file: say so and follow the documents

When implementing a feature (inside the Development Flow, test-first, ADR-0039):
1. Prisma schema + migration (review the generated SQL: ADR-0022, ADR-0023, ADR-0036)
2. For each behaviour, one slice at a time:
   a. Red: one failing test at an approved seam (endpoint first; isolation and
      concurrency tests where relevant). Run it, see it fail for the right reason
   b. Green: the minimal code, layer by layer as the test needs it —
      DTO (Zod) → controller (@ZodResponse) → service (rules, transactions,
      events after commit) → repository (workspaceId as a direct column)
   c. For ⚠️ parts: stop after (a); the developer writes (b); then review
3. Frontend: the same loop with Vitest + Testing Library
4. Full suite, review, refactor; explain what was built and why

When fixing a bug (skill diagnosing-bugs):
1. Build a fast feedback loop that reproduces the bug, then minimise it
2. Rank hypotheses, test them one at a time; explain the root cause
3. Write the regression test, see it fail, fix, see it pass; run the full suite
```

### Agent Skills

The agent uses the project skills in `.claude/skills/` at fixed steps of the flow; the table is in CLAUDE.md "Agent skills". The developer can start some of them directly:

| Command | When |
|---|---|
| `/grill-me` | Before a spec, or on any open question (for example the domain question of ADR-0029) |
| `/grill-with-docs` | When a feature brings new domain words (start of M3, M4, M5, M6) |
| `/handoff` | Before ending a long session, so the next one starts from a short document |

`grilling`, `domain-modeling`, `tdd`, `diagnosing-bugs`, `review-against-spec` and `pr` are picked up by the agent when the step needs them.

### Prompt Templates for Common Tasks

**Implementing a new feature:**
```
Implement [feature] for milestone [N], branch [name].

Context:
- Spec / plan / tasks: docs/specs|plans|tasks/[branch].md
- ADRs: [list]
- Related existing files: [list]
- Tables involved: [list]

Follow RULE.md, the ADRs and WORKFLOW.md.
```

**Adding a new endpoint:**
```
Add [METHOD] [path].

It should:
- [What it does]
- [Validation rules]
- [Who can access it — which roles]
- [What it returns, which events it publishes]

Related Prisma model: [model]
Follow Controller → Service → Repository (RULE.md §3).
```

**Fixing a bug:**
```
Bug: [what is wrong]
Expected: [what should happen]
Actual: [what happens]
Request id / logs: [if from production]

Relevant files:
- [paths]

Find the root cause, add a failing test, fix it.
```

---

## 10. Reference Files

```
CLAUDE.md                        ← Entry point: rules for agents, current status, decision index
RULE.md                          ← Code rules and standards (backend §1–§10, frontend §11)
WORKFLOW.md                      ← This file: plan, NFR, architecture, schema, API, milestones
WORKFLOW-VI.md                   ← Vietnamese translation of this file + glossary
GLOSSARY.md                      ← Domain language: one name per concept, used in code, API and UI
.claude/skills/                  ← Project agent skills and their adaptations (README.md)
docs/adr/                        ← Architecture Decision Records (one decision per file)
docs/specs/ docs/plans/ docs/tasks/   ← Per-branch spec, plan, task list
apps/api/prisma/schema.prisma    ← Source of truth for implemented tables
apps/api/openapi.json            ← Generated API contract (from M2)
.env.example                     ← Every environment variable with a placeholder
docker-compose.yml               ← Local infrastructure
README.md                        ← Public project documentation (completed in M7)
```

---

## Changelog

| Date | Change |
|---|---|
| 2026-11-04 | Initial workflow document created |
| 2026-11-21 | System design review: Non-Functional Requirements & Capacity Budget (§3); architecture, module map and critical flows (§3); schema with tenant keys, composite FKs, timestamptz, partial unique indexes (§4); API conventions and endpoints updated (§5); features updated (§6); milestones re-planned as vertical slices deployed from M2 (§7); deployment updated for verified free-tier limits (§8). Decisions recorded as ADR-0001 … ADR-0038 |
| 2026-11-21 | Glossary session (`GLOSSARY.md`): workspaces have no slug; ownership transfer makes the previous Owner an Admin; each Board has one Done column that drives completion; blocking and deleting Users are operator actions, self-service deletion is an M7 stretch |
| 2026-11-21 | Agent skills adopted (`.claude/skills/`, CLAUDE.md "Agent skills"); development flow switched to test-first at seams agreed in the plan (ADR-0039, §9) |
