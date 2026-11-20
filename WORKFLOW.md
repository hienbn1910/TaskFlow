# WorkSpace — Project Workflow & Master Plan

> This document is the single source of truth for the entire project.
> Both human developers and AI assistants must read this before doing any work.
> Last updated: 2026-11-04

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Feature Specifications](#6-feature-specifications)
7. [Milestones & Timeline](#7-milestones--timeline)
8. [Deployment Plan](#8-deployment-plan)
9. [How to Work on This Project](#9-how-to-work-on-this-project)
10. [Reference Files](#10-reference-files)

---

## 1. Project Overview

### What is WorkSpace?

WorkSpace is a **multi-tenant SaaS collaboration platform** where teams can:
- Create isolated workspaces for their organization
- Communicate in real-time through channels
- Manage tasks on Kanban boards
- Share files and receive notifications

Think of it as a simplified version of Slack + Trello combined into one app.

### Why this project?

This project demonstrates to employers that the developer:
- Can build a production-ready SaaS application
- Understands multi-tenancy and data isolation
- Can implement real-time features
- Knows authentication, authorization, and security best practices
- Can deploy and maintain a live application
- Writes clean, tested, documented code

### Target audience for this portfolio

- Companies hiring **NestJS / Node.js backend developers**
- Companies hiring **fullstack TypeScript developers**
- Companies building **SaaS products**

---

## 2. Tech Stack & Why

### Backend

| Technology | Purpose | Why chosen |
|---|---|---|
| **NestJS** | API framework | Modular architecture, built-in DI, TypeScript-first, similar patterns to Angular/ASP.NET — shows strong architectural thinking |
| **TypeScript** | Language | Type safety, better DX, catches bugs at compile time |
| **PostgreSQL** | Primary database | Robust, supports complex queries, great for multi-tenant with row-level filtering |
| **Prisma** | ORM | Type-safe queries, excellent migration system, better DX than TypeORM |
| **Redis** | Cache + Queue broker | Fast in-memory store for caching, session, and Bull job queue |
| **Bull** | Background jobs | Reliable job processing, retry logic, built on Redis |
| **Socket.io** | Real-time | WebSocket with fallback, room-based messaging, wide browser support |
| **Passport.js** | Authentication | Industry standard for Node.js auth, JWT strategy |
| **Zod** | Validation | Runtime type checking, schema-first, better than class-validator for strict validation |
| **Cloudinary** | File storage | Free tier generous, image transformation built-in, easier than S3 for portfolio project |
| **Nodemailer** | Email | Simple, works with any SMTP provider |

### Frontend

| Technology | Purpose | Why chosen |
|---|---|---|
| **React 18+** | UI framework | Industry standard, large ecosystem, developer already knows it |
| **Vite** | Build tool | Fast HMR, simple config, better DX than CRA |
| **TypeScript** | Language | Consistent with backend, type safety |
| **TanStack Query** | Server state | Caching, refetching, optimistic updates — handles API state properly |
| **Zustand** | Client state | Lightweight, simple API, no boilerplate like Redux |
| **Socket.io-client** | Real-time | Matches backend Socket.io |
| **dnd-kit** | Drag and drop | Modern, accessible, lightweight — for Kanban board |
| **Tailwind CSS** | Styling | Utility-first, fast development, consistent design |
| **React Hook Form + Zod** | Forms | Performance (no unnecessary re-renders), Zod schema shared with backend |
| **React Router v6** | Routing | Standard for React SPA |

### DevOps & Infrastructure

| Technology | Purpose | Why chosen |
|---|---|---|
| **Docker** | Containerization | Consistent environments, easy deployment |
| **Docker Compose** | Local development | One command to start all services |
| **GitHub Actions** | CI/CD | Free for public repos, integrated with GitHub |
| **Render.com** | Backend hosting | Free tier, supports Docker, auto-deploy from GitHub |
| **Vercel** | Frontend hosting | Free, optimized for React/Vite, instant deploys |
| **Neon** | PostgreSQL hosting | Free tier with 0.5GB, serverless PostgreSQL |
| **Upstash** | Redis hosting | Free tier with 10K commands/day, serverless Redis |

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

```
┌─────────────┐     HTTPS      ┌──────────────────────────────────┐
│             │ ──────────────► │           BACKEND                │
│   REACT     │     REST API    │         (NestJS)                 │
│   (Vite)    │                 │                                  │
│             │ ◄─────────────► │  ┌─────────┐  ┌──────────────┐  │
│  Vercel     │   Socket.io     │  │ Guards   │  │ Controllers  │  │
│             │                 │  │ & Pipes  │──│              │  │
└─────────────┘                 │  └─────────┘  └──────┬───────┘  │
                                │                      │          │
                                │               ┌──────▼───────┐  │
                                │               │  Services    │  │
                                │               │  (Business   │  │
                                │               │   Logic)     │  │
                                │               └──────┬───────┘  │
                                │                      │          │
                                │               ┌──────▼───────┐  │
                                │               │ Repositories │  │
                                │               └──────┬───────┘  │
                                │                      │          │
                                │  Render.com          │          │
                                └──────────────────────┼──────────┘
                                                       │
                          ┌────────────────────────────┼────────────────┐
                          │                            │                │
                   ┌──────▼───────┐           ┌───────▼──────┐  ┌──────▼──────┐
                   │ PostgreSQL   │           │    Redis     │  │ Cloudinary  │
                   │ (Neon)       │           │  (Upstash)   │  │ (Files)     │
                   │              │           │              │  │             │
                   │ - Users      │           │ - Cache      │  │ - Images    │
                   │ - Workspaces │           │ - Sessions   │  │ - Documents │
                   │ - Messages   │           │ - Job Queue  │  │ - Avatars   │
                   │ - Tasks      │           │ - Pub/Sub    │  │             │
                   └──────────────┘           └──────────────┘  └─────────────┘
```

### Request Flow (mỗi request đi qua các bước sau)

```
Client Request
     │
     ▼
[Global Middleware]     → Logger, CORS, Compression, Rate Limit
     │
     ▼
[Auth Guard]           → Verify JWT token, extract user
     │
     ▼
[Workspace Guard]      → Verify user belongs to workspace, extract role
     │
     ▼
[Validation Pipe]      → Validate request body/params using Zod
     │
     ▼
[Controller]           → Parse request, call service
     │
     ▼
[Service]              → Business logic, call repository
     │
     ▼
[Repository]           → Database query (always filtered by workspaceId)
     │
     ▼
[Response Interceptor] → Transform response to standard format
     │
     ▼
Client Response
```

### Real-time Architecture (WebSocket)

```
Client connects → Socket.io handshake → JWT verified
     │
     ▼
Client joins room → "workspace:{workspaceId}" room
     │
     ▼
When event happens (new message, task update):
  1. Service processes the action
  2. Service emits event to WebSocket Gateway
  3. Gateway broadcasts to room
  4. All connected clients in that workspace receive update
```

### Background Job Flow

```
Service creates job → Bull Queue (Redis)
     │
     ▼
Bull Worker picks up job → processes it
     │
     ├── Email job: send email via Nodemailer
     ├── Notification job: create notification + emit WebSocket event
     └── Cleanup job: remove expired invitations, old notifications
```

---

## 4. Database Design

### Entity Relationship Diagram

```
users ─────────────┐
  │                 │
  │ (one to many)   │ (one to many)
  │                 │
  ▼                 ▼
workspace_members  invitations
  │                 │
  │ (many to one)   │ (many to one)
  │                 │
  ▼                 ▼
workspaces ────────┘
  │
  │ (one to many)
  ├──────────────────────────┐
  │                          │
  ▼                          ▼
channels                   boards
  │                          │
  │ (one to many)            │ (one to many)
  │                          │
  ├── channel_members        ├── board_columns
  │                          │     │
  ▼                          │     │ (one to many)
messages                     │     │
  │                          │     ▼
  │ (one to many)            │   tasks
  ▼                          │
message_attachments          │
                             │
notifications ◄──────────────┘ (polymorphic reference)
```

### Complete Schema Definitions

#### users
```
id            UUID        PRIMARY KEY, default uuid_generate_v4()
email         VARCHAR     UNIQUE, NOT NULL
password      VARCHAR     NOT NULL (bcrypt hashed)
fullName      VARCHAR     NOT NULL
avatarUrl     VARCHAR     NULLABLE
isActive      BOOLEAN     DEFAULT true
lastLoginAt   TIMESTAMP   NULLABLE
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE
```

#### workspaces
```
id            UUID        PRIMARY KEY
name          VARCHAR     NOT NULL, max 100 chars
slug          VARCHAR     UNIQUE, NOT NULL (URL-friendly, lowercase, no spaces)
description   VARCHAR     NULLABLE, max 500 chars
logoUrl       VARCHAR     NULLABLE
ownerId       UUID        FK → users.id, NOT NULL
deletedAt     TIMESTAMP   NULLABLE (soft delete)
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE

INDEX: slug
INDEX: ownerId
```

#### workspace_members
```
id            UUID        PRIMARY KEY
workspaceId   UUID        FK → workspaces.id, NOT NULL
userId        UUID        FK → users.id, NOT NULL
role          ENUM        'OWNER' | 'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
joinedAt      TIMESTAMP   DEFAULT now()

UNIQUE: (workspaceId, userId)
INDEX: workspaceId
INDEX: userId
```

#### channels
```
id            UUID        PRIMARY KEY
workspaceId   UUID        FK → workspaces.id, NOT NULL
name          VARCHAR     NOT NULL, max 80 chars
description   VARCHAR     NULLABLE, max 300 chars
type          ENUM        'PUBLIC' | 'PRIVATE', DEFAULT 'PUBLIC'
createdById   UUID        FK → users.id, NOT NULL
deletedAt     TIMESTAMP   NULLABLE (soft delete)
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE

UNIQUE: (workspaceId, name)  — no duplicate channel names in same workspace
INDEX: workspaceId
```

#### channel_members
```
id            UUID        PRIMARY KEY
channelId     UUID        FK → channels.id, NOT NULL
userId        UUID        FK → users.id, NOT NULL
lastReadAt    TIMESTAMP   NULLABLE (for unread message count)
joinedAt      TIMESTAMP   DEFAULT now()

UNIQUE: (channelId, userId)
INDEX: channelId
INDEX: userId
```

#### messages
```
id            UUID        PRIMARY KEY
channelId     UUID        FK → channels.id, NOT NULL
senderId      UUID        FK → users.id, NOT NULL
content       TEXT        NOT NULL
parentId      UUID        FK → messages.id, NULLABLE (thread reply)
isEdited      BOOLEAN     DEFAULT false
deletedAt     TIMESTAMP   NULLABLE (soft delete)
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE

INDEX: channelId, createdAt (composite — for paginated message loading)
INDEX: parentId (for thread queries)
```

#### message_attachments
```
id            UUID        PRIMARY KEY
messageId     UUID        FK → messages.id, NOT NULL
fileUrl       VARCHAR     NOT NULL
fileName      VARCHAR     NOT NULL
fileSize      INTEGER     NOT NULL (bytes)
mimeType      VARCHAR     NOT NULL

INDEX: messageId
```

#### boards
```
id            UUID        PRIMARY KEY
workspaceId   UUID        FK → workspaces.id, NOT NULL
name          VARCHAR     NOT NULL, max 100 chars
createdById   UUID        FK → users.id, NOT NULL
deletedAt     TIMESTAMP   NULLABLE (soft delete)
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE

INDEX: workspaceId
```

#### board_columns
```
id            UUID        PRIMARY KEY
boardId       UUID        FK → boards.id, NOT NULL
name          VARCHAR     NOT NULL, max 50 chars
position      INTEGER     NOT NULL (ordering — 0, 1, 2...)
color         VARCHAR     NULLABLE (hex color for UI)
createdAt     TIMESTAMP   DEFAULT now()

INDEX: boardId, position (composite)
```

#### tasks
```
id            UUID        PRIMARY KEY
columnId      UUID        FK → board_columns.id, NOT NULL
title         VARCHAR     NOT NULL, max 200 chars
description   TEXT        NULLABLE
priority      ENUM        'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', DEFAULT 'MEDIUM'
dueDate       TIMESTAMP   NULLABLE
position      INTEGER     NOT NULL (ordering within column)
assigneeId    UUID        FK → users.id, NULLABLE
createdById   UUID        FK → users.id, NOT NULL
completedAt   TIMESTAMP   NULLABLE
createdAt     TIMESTAMP   DEFAULT now()
updatedAt     TIMESTAMP   AUTO UPDATE

INDEX: columnId, position (composite)
INDEX: assigneeId
INDEX: dueDate (for reminder queries)
```

#### invitations
```
id            UUID        PRIMARY KEY
workspaceId   UUID        FK → workspaces.id, NOT NULL
email         VARCHAR     NOT NULL
role          ENUM        'ADMIN' | 'MEMBER', DEFAULT 'MEMBER'
token         VARCHAR     UNIQUE, NOT NULL (random string for invite link)
status        ENUM        'PENDING' | 'ACCEPTED' | 'EXPIRED', DEFAULT 'PENDING'
invitedById   UUID        FK → users.id, NOT NULL
expiresAt     TIMESTAMP   NOT NULL (default: 7 days from creation)
createdAt     TIMESTAMP   DEFAULT now()

UNIQUE: (workspaceId, email) — can't invite same email twice to same workspace
INDEX: token (for lookup when accepting)
INDEX: workspaceId
INDEX: expiresAt (for cleanup job)
```

#### notifications
```
id              UUID        PRIMARY KEY
userId          UUID        FK → users.id, NOT NULL (who receives this)
type            ENUM        'TASK_ASSIGNED' | 'TASK_DUE_SOON' | 'MESSAGE_MENTION'
                            | 'INVITATION_RECEIVED' | 'MEMBER_JOINED'
title           VARCHAR     NOT NULL
content         VARCHAR     NULLABLE
referenceId     UUID        NULLABLE (ID of related entity)
referenceType   ENUM        'TASK' | 'MESSAGE' | 'INVITATION' | 'WORKSPACE', NULLABLE
workspaceId     UUID        FK → workspaces.id, NULLABLE (for grouping)
isRead          BOOLEAN     DEFAULT false
createdAt       TIMESTAMP   DEFAULT now()

INDEX: userId, isRead, createdAt (composite — for "unread notifications" query)
INDEX: workspaceId
```

#### refresh_tokens
```
id            UUID        PRIMARY KEY
userId        UUID        FK → users.id, NOT NULL
token         VARCHAR     UNIQUE, NOT NULL (hashed)
expiresAt     TIMESTAMP   NOT NULL
createdAt     TIMESTAMP   DEFAULT now()

INDEX: userId
INDEX: token
INDEX: expiresAt (for cleanup)
```

---

## 5. API Design

### Standard Response Format

```json
// Success (single item)
{
  "success": true,
  "data": { ... }
}

// Success (list with pagination)
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Error
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human readable message",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Complete Endpoint List

#### Auth Module — `/api/v1/auth`
```
POST   /register              Register new account
POST   /login                 Login, returns access + refresh token
POST   /refresh               Refresh access token using refresh token
POST   /logout                Invalidate refresh token
POST   /forgot-password       Send password reset email
POST   /reset-password        Reset password with token
GET    /me                    Get current user profile
```

#### Users Module — `/api/v1/users`
```
PATCH  /profile               Update current user profile
PATCH  /avatar                Upload/change avatar
PATCH  /password              Change password (requires current password)
```

#### Workspaces Module — `/api/v1/workspaces`
```
GET    /                      List workspaces current user belongs to
POST   /                      Create new workspace
GET    /:workspaceId          Get workspace details
PATCH  /:workspaceId          Update workspace (OWNER, ADMIN only)
DELETE /:workspaceId          Soft delete workspace (OWNER only)
```

#### Workspace Members — `/api/v1/workspaces/:workspaceId/members`
```
GET    /                      List workspace members
PATCH  /:memberId/role        Change member role (OWNER, ADMIN only)
DELETE /:memberId             Remove member (OWNER, ADMIN only)
POST   /leave                 Leave workspace (not for OWNER)
```

#### Invitations — `/api/v1/workspaces/:workspaceId/invitations`
```
GET    /                      List pending invitations (ADMIN+)
POST   /                      Invite member by email (ADMIN+)
DELETE /:invitationId         Cancel invitation (ADMIN+)
POST   /accept/:token         Accept invitation (public, no workspace guard)
```

#### Channels — `/api/v1/workspaces/:workspaceId/channels`
```
GET    /                      List channels in workspace
POST   /                      Create channel
GET    /:channelId            Get channel details
PATCH  /:channelId            Update channel
DELETE /:channelId            Soft delete channel (ADMIN+)
POST   /:channelId/join       Join public channel
POST   /:channelId/leave      Leave channel
GET    /:channelId/members    List channel members
```

#### Messages — `/api/v1/workspaces/:workspaceId/channels/:channelId/messages`
```
GET    /                      List messages (paginated, cursor-based)
POST   /                      Send message
PATCH  /:messageId            Edit message (sender only)
DELETE /:messageId            Soft delete message (sender or ADMIN)
GET    /:messageId/thread     Get thread replies
```

#### Boards — `/api/v1/workspaces/:workspaceId/boards`
```
GET    /                      List boards in workspace
POST   /                      Create board
GET    /:boardId              Get board with columns and tasks
PATCH  /:boardId              Update board name
DELETE /:boardId              Soft delete board (ADMIN+)
```

#### Board Columns — `/api/v1/workspaces/:workspaceId/boards/:boardId/columns`
```
POST   /                      Create column
PATCH  /:columnId             Update column (name, color)
DELETE /:columnId             Delete column (must be empty or move tasks)
PATCH  /reorder               Reorder columns (send array of { id, position })
```

#### Tasks — `/api/v1/workspaces/:workspaceId/boards/:boardId/tasks`
```
GET    /                      List tasks (filter by column, assignee, priority, due date)
POST   /                      Create task
GET    /:taskId               Get task details
PATCH  /:taskId               Update task
DELETE /:taskId               Delete task
PATCH  /:taskId/move          Move task to another column + position (drag-drop)
PATCH  /:taskId/assign        Assign/unassign member
```

#### Notifications — `/api/v1/notifications`
```
GET    /                      List notifications for current user (paginated)
GET    /unread-count          Get unread notification count
PATCH  /:notificationId/read  Mark as read
PATCH  /read-all              Mark all as read
```

#### Uploads — `/api/v1/uploads`
```
POST   /image                 Upload image (avatar, workspace logo)
POST   /file                  Upload file (message attachment)
```

### WebSocket Events

```
// Client → Server
socket.emit('join-workspace', { workspaceId })
socket.emit('leave-workspace', { workspaceId })
socket.emit('join-channel', { channelId })
socket.emit('leave-channel', { channelId })
socket.emit('typing', { channelId, userId })
socket.emit('stop-typing', { channelId, userId })

// Server → Client
socket.on('new-message', { message, channelId })
socket.on('message-updated', { message, channelId })
socket.on('message-deleted', { messageId, channelId })
socket.on('user-typing', { channelId, userId, fullName })
socket.on('user-stop-typing', { channelId, userId })
socket.on('task-updated', { task, boardId })
socket.on('task-moved', { taskId, fromColumnId, toColumnId, position })
socket.on('member-joined', { workspaceId, user })
socket.on('member-left', { workspaceId, userId })
socket.on('notification', { notification })
```

---

## 6. Feature Specifications

### Feature 1: Authentication

**User Registration**
- Input: email, password, fullName
- Validate: email format, password min 8 chars (1 uppercase, 1 number)
- Check email not already registered
- Hash password with bcrypt (salt rounds: 10)
- Create user record
- Generate JWT access token (15 min) + refresh token (7 days)
- Store hashed refresh token in database
- Return tokens + user profile (without password)

**User Login**
- Input: email, password
- Find user by email
- Compare password with bcrypt
- If match: generate new token pair, store refresh token
- If not match: return 401 (do NOT say "wrong password" — say "invalid credentials" to prevent email enumeration)

**Token Refresh**
- Input: refresh token (from httpOnly cookie)
- Find token in database
- If not found or expired: return 401
- If found: delete old token, generate new pair, store new refresh token
- This is called "refresh token rotation" — prevents token reuse attacks

**Logout**
- Delete refresh token from database
- Client clears access token from memory

### Feature 2: Workspaces

**Create Workspace**
- Input: name, slug (optional — auto-generate from name if not provided)
- Validate slug is URL-friendly (lowercase, alphanumeric + hyphens)
- Check slug not taken
- Create workspace
- Create workspace_member record with role OWNER for creator
- Auto-create a "general" channel

**Workspace Guard (runs on every workspace request)**
```
1. Extract workspaceId from URL params
2. Find workspace_member where workspaceId + userId
3. If not found → 403 Forbidden
4. Attach workspaceId and memberRole to request object
5. All subsequent queries use this workspaceId
```

### Feature 3: Channels & Messaging

**Send Message**
- Validate user is member of channel
- Create message record
- If has attachments: upload files, create attachment records
- Emit 'new-message' via WebSocket to channel room
- Create notifications for @mentioned users (parse content for @mentions)

**Load Messages (cursor-based pagination)**
```
GET /messages?cursor=<lastMessageId>&limit=20

Why cursor-based instead of offset?
- Offset pagination breaks when new messages arrive (items shift)
- Cursor pagination is stable — always loads messages before/after a fixed point
- Better performance on large datasets (no OFFSET scan)
```

**Typing Indicator**
- Client sends 'typing' event when user starts typing
- Server broadcasts to channel room
- Client sends 'stop-typing' after 3 seconds of no keypress
- Server-side timeout: auto-clear typing after 5 seconds (in case client disconnects)

### Feature 4: Kanban Board

**Drag and Drop — Position Management**
```
When task moves from Column A position 2 → Column B position 1:

1. Update moved task: columnId = B, position = 1
2. Tasks in Column B with position >= 1: increment position by 1
3. Tasks in Column A with position > 2: decrement position by 1
4. All in a single database transaction

Gap-based positioning (alternative, simpler):
- Instead of 0, 1, 2, 3 use 1000, 2000, 3000, 4000
- Moving between 2000 and 3000 → set position to 2500
- Only rebalance when gap gets too small (< 1)
- Fewer database updates per move
```

**Task Assignment**
- When assigning a task to a user, verify user is workspace member
- Create notification for assignee
- If task has dueDate, schedule reminder job

### Feature 5: Notifications

**Types and Triggers**
```
TASK_ASSIGNED       → when someone assigns a task to you
TASK_DUE_SOON       → 24 hours before due date (background job)
MESSAGE_MENTION     → when someone @mentions you in a message
INVITATION_RECEIVED → when you're invited to a workspace
MEMBER_JOINED       → when someone joins your workspace (notify admins)
```

**Delivery**
- In-app: create notification record + emit WebSocket event
- Email: for INVITATION_RECEIVED and TASK_DUE_SOON (via background job)

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
3.1  Schema: workspaces, workspace_members (composite keys, ADR-0021; partial unique slug)
3.2  WorkspaceGuard: membership + workspace not deleted; attaches workspaceId and role
3.3  Decorators: @CurrentWorkspace(), @WorkspaceRoles(...)
3.4  CRUD: list mine, create (slug auto-generated, retry on conflict), get, update, soft delete
3.5  Transfer ownership (ADR-0032); domain event workspace.created
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
- Isolation suite: a member of workspace A gets 403/404 on **every** workspace-B endpoint (read and write)
- Concurrency: double accept, slug race (ADR-0032)
- Role matrix: OWNER / ADMIN / MEMBER × every member and invitation action

**Completion criteria (on production):**
- [ ] Create a workspace, copy an invite link, a second account accepts it, both see each other in members
- [ ] A MEMBER cannot invite (403); an outsider gets 403 on every URL of the workspace
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
5.2  Board CRUD (soft delete ADMIN+), default columns (Todo, In Progress, Done)
5.3  Column CRUD (delete only when empty) and reorder
5.4  Web: board list, board page with columns
```

**Branch `feature/tasks`**
```
5.5  Schema: tasks (workspaceId, boardId, composite FK to column, dueDate timestamptz,
     reminderSentAt) (ADR-0021, 0028)
5.6  CRUD; move with positions and rebalancing in one locking transaction (ADR-0009)
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

**Stretch (only if time remains):** audit log of admin actions, orphan upload cleanup, PostgreSQL Row-Level Security (ADR-0021), Socket.io Redis adapter (ADR-0018 scale path).

**Completion criteria:**
- [ ] Every §3 target measured and written down (or the deviation explained in an ADR)
- [ ] Security checklist complete; Playwright suite green in CI
- [ ] README complete; a recruiter can log in as the demo user and see real content

---

## 8. Deployment Plan

### Local Development

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: workspace
      POSTGRES_PASSWORD: workspace123
      POSTGRES_DB: workspace_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://workspace:workspace123@postgres:5432/workspace_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-change-in-production
      # ... other env vars
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/src:/app/src  # hot reload

volumes:
  postgres_data:
```

### Production Architecture

```
GitHub Push
     │
     ▼
GitHub Actions ──── Lint + Type Check + Test
     │
     ├── Backend passes → Auto-deploy to Render.com
     │                     └── Connects to Neon (PostgreSQL)
     │                     └── Connects to Upstash (Redis)
     │                     └── Connects to Cloudinary (Files)
     │
     └── Frontend passes → Auto-deploy to Vercel
                            └── Connects to Render backend URL
```

### Environment Variables (production)

```
# Backend (.env.production)
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@neon-host/workspace_prod?sslmode=require

# Redis
REDIS_URL=rediss://default:pass@upstash-host:6379

# JWT
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<different-random-64-char-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Email (use Gmail SMTP or Resend for free)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx

# Frontend URL (for CORS)
FRONTEND_URL=https://workspace-app.vercel.app

# Backend URL (for email links)
BACKEND_URL=https://workspace-api.onrender.com
```

### Free Tier Limits to Know

```
Neon (PostgreSQL):     0.5 GB storage, auto-suspend after 5 min idle
Upstash (Redis):       10,000 commands/day, 256 MB storage
Render (Backend):      Spins down after 15 min inactivity, 750 hours/month
Vercel (Frontend):     100 GB bandwidth/month, unlimited deploys
Cloudinary (Files):    25 GB storage, 25 GB bandwidth/month
```

### Handling Free Tier Sleep

Render free tier puts the service to sleep after 15 minutes of inactivity. First request after sleep takes ~30 seconds (cold start).

Options:
1. **Add note in README**: "First load may take 30s due to free hosting cold start"
2. **Setup cron ping**: use a free service like UptimeRobot to ping health endpoint every 14 minutes
3. **Health endpoint**: GET /api/v1/health returns { status: 'ok', timestamp: ... }

---

## 9. How to Work on This Project

### For the Human Developer

```
1. Pick a milestone
2. Read the milestone's tasks
3. For each task:
   a. Write a clear prompt describing what you need
   b. Include context: which module, which files exist, what's already done
   c. Review the generated code against RULE.md
   d. Test it manually
   e. Commit with meaningful message
4. When milestone is complete, review all code once more
5. Move to next milestone
```

### For AI Assistants

```
Before generating ANY code:
1. Read RULE.md — follow all rules strictly
2. Read this WORKFLOW.md — understand the full context
3. Check which milestone is being worked on
4. Check what already exists (ask if unsure)
5. Generate code that:
   - Follows the folder structure in RULE.md
   - Uses the tech stack defined in this document
   - Follows the API design patterns defined here
   - Includes proper error handling
   - Includes proper TypeScript types
   - Is ready for the developer to review and commit

When asked to implement a feature:
1. Start with Prisma schema changes (if any)
2. Then repository layer
3. Then service layer (with business logic)
4. Then DTOs with Zod validation
5. Then controller
6. Then tests
7. Always explain what you built and why

When asked to fix a bug:
1. Identify the root cause first
2. Explain why the bug happens
3. Fix it
4. Add a test that would have caught this bug
```

### Prompt Templates for Common Tasks

**Implementing a new feature:**
```
Implement the [feature name] feature for milestone [N].

Context:
- Current module: [module name]
- Related existing files: [list]
- Database tables involved: [list]

Requirements:
- [Copy tasks from milestone section]

Follow RULE.md and WORKFLOW.md.
```

**Adding a new endpoint:**
```
Add [HTTP_METHOD] [endpoint path] endpoint.

This endpoint should:
- [What it does]
- [Validation rules]
- [Who can access it — which roles]
- [What it returns]

Related Prisma model: [model name]
Follow the Controller → Service → Repository pattern from RULE.md.
```

**Fixing a bug:**
```
Bug: [Description of what's wrong]
Expected: [What should happen]
Actual: [What actually happens]

Relevant files:
- [file paths]

Find the root cause, fix it, and add a test.
```

---

## 10. Reference Files

```
WORKFLOW.md          ← This file (project plan, you are here)
RULE.md              ← Code rules and standards
README.md            ← Public project documentation (created in milestone 8)
.env.example         ← Environment variable template
docker-compose.yml   ← Local development setup
```

---

## Changelog

| Date | Change |
|---|---|
| 2026-11-04 | Initial workflow document created |
