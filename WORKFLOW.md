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

### Milestone 1: Foundation + Auth (Week 1–2)

**Goal**: User can register, login, and manage their profile.

**Tasks**:
```
1.1  Initialize NestJS project with TypeScript strict mode
1.2  Setup Docker Compose: PostgreSQL + Redis
1.3  Setup Prisma with initial schema (users + refresh_tokens)
1.4  Create config module with Zod env validation
1.5  Create global exception filter
1.6  Create response interceptor (standard response format)
1.7  Create Zod validation pipe
1.8  Implement auth module:
     - POST /register
     - POST /login
     - POST /refresh
     - POST /logout
     - GET  /me
1.9  Implement user module:
     - PATCH /profile
     - PATCH /password
1.10 Write unit tests for auth service
1.11 Write integration tests for auth endpoints
1.12 Setup Swagger documentation
```

**Completion criteria**:
- [ ] Can register, login, refresh token, logout
- [ ] Invalid credentials return proper error
- [ ] Refresh token rotates correctly
- [ ] Protected endpoints return 401 without token
- [ ] All tests pass
- [ ] Swagger docs accessible at /api/docs

---

### Milestone 2: Workspaces & Members (Week 3)

**Goal**: User can create workspaces, invite members, manage roles.

**Tasks**:
```
2.1  Add Prisma schema: workspaces, workspace_members, invitations
2.2  Create WorkspaceGuard
2.3  Create @CurrentWorkspace() and @WorkspaceRole() decorators
2.4  Implement workspace module:
     - CRUD endpoints
     - Auto-create "general" channel on workspace creation
2.5  Implement workspace members module:
     - List, change role, remove, leave
2.6  Implement invitation module:
     - Create invitation + send email
     - Accept invitation (with token)
     - Cancel invitation
     - Background job: expire old invitations
2.7  Write tests for workspace service (especially multi-tenant isolation)
2.8  Write integration test: user A cannot access workspace B
```

**Completion criteria**:
- [ ] Can create workspace, auto-generates slug
- [ ] Can invite by email, accept invitation via link
- [ ] Role-based access works (OWNER > ADMIN > MEMBER)
- [ ] User cannot access workspace they don't belong to
- [ ] Data isolation test passes
- [ ] Invitation expires after 7 days

---

### Milestone 3: Channels & Messaging (Week 4–5)

**Goal**: Users can chat in real-time within workspace channels.

**Tasks**:
```
3.1  Add Prisma schema: channels, channel_members, messages, message_attachments
3.2  Implement channel module:
     - CRUD + join/leave
     - Public channels: any workspace member can join
     - Private channels: must be invited
3.3  Implement message module:
     - CRUD with cursor-based pagination
     - Thread replies (parentId)
     - Edit and soft-delete own messages
3.4  Setup WebSocket Gateway:
     - JWT authentication on handshake
     - Room management (workspace rooms, channel rooms)
     - Emit events on new message, edit, delete
3.5  Implement typing indicators
3.6  Setup file upload module (Cloudinary):
     - Image upload (avatars, workspace logos)
     - File upload (message attachments)
     - Validate file size and mime type
3.7  Write tests for message service
3.8  Write WebSocket integration tests
```

**Completion criteria**:
- [ ] Can create channels, send messages
- [ ] Messages load with cursor-based pagination
- [ ] Real-time: message appears instantly for all channel members
- [ ] Thread replies work
- [ ] File upload works with size/type validation
- [ ] Typing indicator shows/hides correctly
- [ ] WebSocket requires authentication

---

### Milestone 4: Kanban Board (Week 6–7)

**Goal**: Users can manage tasks on drag-and-drop Kanban boards.

**Tasks**:
```
4.1  Add Prisma schema: boards, board_columns, tasks
4.2  Implement board module:
     - CRUD
     - Auto-create default columns (Todo, In Progress, Done)
4.3  Implement column module:
     - CRUD + reorder
4.4  Implement task module:
     - CRUD
     - Move task between columns (position management)
     - Assign/unassign members
     - Filter by assignee, priority, due date
4.5  Real-time task updates via WebSocket
4.6  Write tests for task move/reorder logic
```

**Completion criteria**:
- [ ] Can create boards with default columns
- [ ] Can create, edit, delete tasks
- [ ] Drag-drop moves task between columns
- [ ] Column reordering works
- [ ] Task assignment notifies assignee
- [ ] Filters work correctly
- [ ] Real-time updates for all board viewers

---

### Milestone 5: Notifications & Background Jobs (Week 8)

**Goal**: Users receive real-time and email notifications.

**Tasks**:
```
5.1  Add Prisma schema: notifications
5.2  Implement notification module:
     - List with pagination
     - Unread count
     - Mark as read / mark all as read
5.3  Create notification service (used by other modules):
     - createNotification(userId, type, data)
     - Saves to DB + emits WebSocket event
5.4  Setup Bull queues:
     - Email queue: send invitation emails, deadline reminders
     - Cleanup queue: expire invitations, delete old notifications
5.5  Implement cron jobs:
     - Every hour: check tasks due in 24 hours → send reminder
     - Every day: expire pending invitations past 7 days
5.6  Write tests for notification service
5.7  Write tests for background jobs
```

**Completion criteria**:
- [ ] Notifications appear in real-time
- [ ] Unread badge count updates
- [ ] Email sent for invitations
- [ ] Deadline reminders sent 24h before due date
- [ ] Expired invitations cleaned up automatically

---

### Milestone 6: Frontend (Week 9–11)

**Goal**: Complete React frontend connected to all backend features.

**Tasks**:
```
6.1  Initialize React + Vite + TypeScript project
6.2  Setup Tailwind CSS + base design system (colors, spacing, typography)
6.3  Setup React Router with layout structure:
     - Public layout (login, register, accept invitation)
     - Dashboard layout (sidebar, header, main content)
6.4  Setup TanStack Query + Axios instance with interceptors:
     - Auto-attach JWT to requests
     - Auto-refresh token on 401
     - Global error handling
6.5  Setup Zustand stores:
     - AuthStore (user, tokens)
     - WorkspaceStore (current workspace, members)
     - NotificationStore (unread count)
6.6  Setup Socket.io client:
     - Connect on login, disconnect on logout
     - Join workspace room on workspace switch
6.7  Implement pages:
     - Auth: Login, Register, Forgot Password
     - Workspace: List, Create, Settings
     - Channel: Sidebar list, Message view, Thread panel
     - Board: Kanban view with drag-drop
     - Notifications: Dropdown + full page
     - Profile: Edit profile, Change password
6.8  Implement real-time features:
     - New messages appear instantly
     - Typing indicators
     - Task board updates
     - Notification badge
6.9  Responsive design (mobile-friendly)
6.10 Loading states, empty states, error states for all pages
```

**Completion criteria**:
- [ ] All pages functional and connected to backend
- [ ] Real-time features work
- [ ] Token refresh works transparently
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] All states handled (loading, empty, error)

---

### Milestone 7: Testing & Polish (Week 12)

**Goal**: Production-ready code quality.

**Tasks**:
```
7.1  Backend: ensure all unit tests pass
7.2  Backend: ensure all integration tests pass
7.3  Backend: add missing tests for edge cases
7.4  Frontend: add tests for critical components (optional but good)
7.5  API documentation complete in Swagger
7.6  Seed data script: creates demo workspace with sample data
7.7  Rate limiting on all endpoints
7.8  Security audit:
     - Check all endpoints have auth guards
     - Check all queries filter by workspaceId
     - Check no sensitive data in responses
     - Check error messages don't leak internals
7.9  Performance check:
     - No N+1 queries (check Prisma logs)
     - Indexes on frequently queried columns
     - Response times under 200ms for common endpoints
```

---

### Milestone 8: Deploy & Documentation (Week 13)

**Goal**: Live application accessible via URL.

**Tasks**:
```
8.1  Create production Dockerfile (multi-stage build)
8.2  Setup environment variables for production
8.3  Deploy PostgreSQL on Neon
8.4  Deploy Redis on Upstash
8.5  Deploy backend on Render.com:
     - Connect to GitHub repo
     - Set environment variables
     - Health check endpoint
8.6  Deploy frontend on Vercel:
     - Connect to GitHub repo
     - Set environment variables (API URL)
8.7  Setup GitHub Actions:
     - On push to main: lint → type check → test → deploy
8.8  Setup health check / keep-alive ping for Render free tier
8.9  Write README.md:
     - Project description with screenshots/GIF
     - Live demo link
     - Tech stack with brief explanations
     - Architecture diagram
     - How to run locally (docker-compose up)
     - How to run tests
     - API documentation link
     - Technical decisions explained
8.10 Create seed data so demo always has sample content
8.11 Final testing on production URLs
```

**Completion criteria**:
- [ ] Backend live and responding at render URL
- [ ] Frontend live and working at vercel URL
- [ ] Can register, create workspace, chat, manage tasks on live version
- [ ] README is complete with screenshots
- [ ] docker-compose up works for local development
- [ ] CI/CD pipeline passes

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
