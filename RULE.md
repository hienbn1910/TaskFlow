# Project Rules — TaskFlow

> Every code generation must read and follow this file before writing any code.
> Decisions behind these rules are in [`docs/adr/`](docs/adr/README.md). If a rule here and an ADR disagree, the ADR wins and this file is corrected (ADR-0038).

---

## 0. Development Flow
> Every feature must go through all the steps below. No steps can be skipped.

```
[Spec] → [Plan + seams] → [Decompose tasks] → ┌ [Red: failing test] → [Green: minimal code] ┐ → [Run full suite]
                                               └──────── repeat, one slice at a time ───────┘
        → [Fix] → [Review: spec + standards, performance, security] → [Refactor] → [PR]
```

Development is test-first (ADR-0039). The agent skills used at each step are listed in CLAUDE.md "Agent skills".

### Step 1: Spec (Specification)
- Read the ADRs listed for the milestone (WORKFLOW.md §7) and `GLOSSARY.md` first.
- Clearly describe the feature's requirements, inputs/outputs, and edge cases, in the `GLOSSARY.md` vocabulary.
- Define the scope: identify affected endpoints, socket events, modules, and database tables.
- List the acceptance criteria. Write the spec to `docs/specs/<branch>.md`.
- Open questions are settled with the developer in rounds (skill `grilling`; `grill-with-docs` when the domain language changes).
### Step 2: Plan
- Define the data flow: Controller → Service → Repository, and the domain events published / consumed.
- List the files that need to be created or modified.
- Identify the necessary Zod schemas, DTOs, and entity mappings.
- Determine dependencies on other modules (one direction only, §1).
- **Seams under test:** list the seams (§7), one line each: what it catches, what it misses. Approving the plan approves the seams.
- Write the plan to `docs/plans/<branch>.md`. A decision that meets the ADR criteria (`docs/adr/README.md`) becomes an ADR.
### Step 3: Task Decomposition (by AI Agent)
- Break the feature into small vertical slices, each one behaviour that a test can show (one commit each).
- Order tasks by dependency (Schema → the endpoint or logic it serves → Frontend). Each task names its test first, then the code.
- Mark the important parts ⚠️: for those, the agent writes the failing test and the code, explains them, and stops for the developer's review (ADR-0039).
- Write the tasks to `docs/tasks/<branch>.md`.
### Step 4: Red — write a failing test
- Write **one** test for the next behaviour, at a seam approved in the plan (§7, skill `tdd`).
- Run it and see it fail for the expected reason (not a typo or a missing import).
- The AI must read `RULE.md` before writing any test or code.
### Step 5: Green — write the minimal code
- Write only the code the failing test needs, following the folder structure and architecture rules (§1, §3).
- Run the test and see it pass. Then return to Step 4 for the next slice of the task.
- Do not write code that no test asks for; do not refactor here.
### Step 6: Test Execution
- Run the entire test suite—not just the new tests.
- Ensure no existing tests are broken (prevent regressions).
### Step 7: Fix
- Resolve any failing tests.
- If a fix impacts other logic, return to Step 6.
- A bug that needs investigation follows the `diagnosing-bugs` skill: feedback loop first, regression test before the fix.
### Step 8: Review — Spec, Standards, Performance, Security
- Review the branch diff against the spec and against this file (skill `review-against-spec`).
- Verify against the Performance Checklist (Section 4).
- Verify against Security Requirements (Section 5).
- Crucially: ensure all queries include `workspaceId`, raw Prisma models are not exposed, and socket events go only to authorized rooms.
### Step 9: Refactor
- With every test green: eliminate redundant code.
- Ensure functions are ≤ 30 lines long and have ≤ 3 parameters.
- Maintain consistent naming conventions (`GLOSSARY.md`).
- Verify the order of imports. Run the full suite again.
### Step 10: PR (Pull Request)
- Follow the commit message format specified in Section 8
- Update the docs: CLAUDE.md status, ADR index, WORKFLOW.md **and** WORKFLOW-VI.md if the plan changed (ADR-0038), `GLOSSARY.md` if terms changed
- Write the PR description with the `pr` skill template (Summary, Evidence, Merge Danger)
- Ensure that linting, type checking, and all tests pass

## 1. Folder Structure

### API (`apps/api`)

```
prisma/                        # schema.prisma, migrations/, seed.ts (Decision #2)
prisma7.config.ts              # Prisma CLI config (Decision #12)
openapi.json                   # Generated API contract, committed (ADR-0033)
src/
├── common/
│   ├── constants/             # Error codes, auth constants, config keys
│   ├── cookies/               # Refresh cookie options + service (Decision #17)
│   ├── decorators/            # @CurrentUser, @Public, @CurrentWorkspace, @WorkspaceRoles
│   ├── events/                # Domain event classes shared across modules (ADR-0026)
│   ├── filters/               # Global exception filter (HTTP); WS exception filter
│   ├── guards/                # JwtAuthGuard, WorkspaceGuard, OriginGuard
│   ├── interceptors/          # Response envelope, logging context
│   ├── logging/               # pino-http options, request id (ADR-0035)
│   ├── throttling/            # Rate limit table, named throttlers, credentials key (ADR-0031)
│   ├── types/                 # Shared types, schemas and DTOs used by 2+ modules
│   └── utils/                 # Pure helper functions (no side effects)
├── config/                    # Zod-validated env config (app, database, redis, jwt, …)
├── generated/                 # Prisma client (gitignored, Decision #12)
├── modules/
│   ├── <feature>/
│   │   ├── <feature>.controller.ts
│   │   ├── <feature>.service.ts
│   │   ├── <feature>.repository.ts
│   │   ├── <feature>.listener.ts   # Domain event listeners, if any
│   │   ├── <feature>.module.ts
│   │   ├── dto/               # Request/Response DTOs with Zod schemas
│   │   ├── entities/          # Our own types (NOT raw Prisma types)
│   │   ├── exceptions/        # Module-specific HttpException subclasses, if any
│   │   └── __tests__/
│   ├── realtime/              # Socket.io gateway, rooms, presence, event names (ADR-0025)
│   └── jobs/                  # BullMQ queues, processors, hourly tick (ADR-0027)
├── openapi/                   # buildOpenApiDocument + serializeOpenApi: Swagger, export, contract test (ADR-0033)
├── prisma/                    # PrismaService + PrismaModule only
├── redis/                     # Global REDIS_CLIENT (ioredis); Redis is disposable (ADR-0027)
├── scripts/                   # One-off CLI entry points run from dist/ (openapi:export)
├── setup-app.ts               # HTTP setup shared by main.ts and E2E tests
├── app.module.ts
└── main.ts
test/                          # E2E / integration tests against the real test database
```

### Web (`apps/web`) — see §11

### Rules:
- One module per feature — never mix features in one module
- Every module must have its own dto/ folder — no shared DTOs between modules
- If two modules need the same DTO or schema, extract it to common/types/
- Test files live next to the code they test, inside __tests__/
- No circular dependencies between modules — if A needs B and B needs A, extract shared logic to a new module, or turn the side effect into a domain event (ADR-0026). No `forwardRef`

---

## 2. Code Style

### TypeScript
- **Strict mode required** — `"strict": true` in tsconfig.json
- **No `any`** — use `unknown` if type is truly unknown, then narrow it
- **No type assertions (`as`)** unless absolutely necessary — add a comment explaining why
- **No non-null assertions (`!`)** — handle null/undefined explicitly
- **Use `readonly` for properties that should not change after initialization**

### Async
- **Always use async/await** — never `.then()/.catch()` chains
- **Always handle errors** — every async call must be in try/catch or have error propagated to the caller
- **Never use `Promise.all()` for DB writes** — use transactions instead
- **Use `Promise.all()` for independent read operations** to improve performance

### Naming Conventions
```
Files:           kebab-case          → create-workspace.dto.ts
Classes:         PascalCase          → WorkspaceService
Interfaces:      PascalCase (no I)   → WorkspaceRepository (not IWorkspaceRepository)
Functions:       camelCase           → findByWorkspaceId()
Variables:       camelCase           → workspaceMembers
Constants:       UPPER_SNAKE_CASE    → MAX_FILE_SIZE
Enums:           PascalCase          → MemberRole.ADMIN
DB columns:      camelCase in Prisma → maps to snake_case in PostgreSQL
API endpoints:   kebab-case          → /api/v1/workspaces/:workspaceId/transfer-ownership
Domain events:   entity.action       → message.created, task.assigned   (internal, ADR-0026)
Socket events:   resource:verb       → message:created, typing:start    (ADR-0025)
Job names:       queue.action        → email.send, reminders.scan       (ADR-0027)
```

### Function Rules
- Max 30 lines per function — if longer, extract helper functions
- Max 3 parameters — if more, use an options object
- Every function must have a single responsibility
- No nested ternaries — use if/else or early return
- Prefer early return pattern over deep nesting

### Import Order
```typescript
// 1. NestJS/external packages
import { Injectable } from '@nestjs/common';

// 2. Common/shared modules
import { WorkspaceGuard } from '@common/guards/workspace.guard';

// 3. Same module imports
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
```

---

## 3. Architecture Rules

### Controller
- ONLY handles HTTP concerns: parse request, call service, return response
- No business logic — not even simple if/else conditions
- Must use DTOs for input validation and `@ZodResponse` for response shaping (Decision #13)
- Must use decorators for auth, roles, workspace context

```typescript
// GOOD
@Post()
@ZodResponse({ type: WorkspaceResponseDto, status: 201 })
async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: AuthUser) {
  return this.workspaceService.create(dto, user.id);
}

// BAD — business logic in controller
@Post()
async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: AuthUser) {
  const owned = await this.prisma.workspace.count({ where: { ownerId: user.id } });
  if (owned >= MAX_OWNED_WORKSPACES) throw new ForbiddenException();
  // ...
}
```

### Service
- Contains ALL business logic
- Calls repository for data access — never calls Prisma directly
- Must validate business rules before performing actions
- Returns mapped DTOs/entities — never raw Prisma models
- **Publishes domain events only after the write has committed** — after the repository call or transaction returns, never inside a `$transaction` callback (ADR-0026)
- Never calls the WebSocket gateway, the mailer or another feature's write path directly for a side effect: publish an event instead

### Repository
- ONLY handles database queries
- No business logic — no if/else based on business rules
- Must use Prisma parameterized queries (never raw string interpolation)
- Every query for tenant-scoped data MUST include `workspaceId` **as a direct column** (ADR-0021)
- Soft-deleted entities: every read includes `deletedAt: null` (ADR-0022)
- Uniqueness is enforced by database constraints, not by "check then insert" (ADR-0032)

```typescript
// GOOD
async findTasks(workspaceId: string, boardId: string, filters: TaskFilters) {
  return this.prisma.task.findMany({
    where: { workspaceId, boardId, ...filters },
    select: TASK_SELECT,
  });
}

// BAD — missing workspaceId = data leak across tenants
async findTasks(filters: TaskFilters) {
  return this.prisma.task.findMany({ where: filters });
}
```

### Raw SQL (ADR-0024)
- Only when the Prisma API cannot express the query, only inside a repository
- Only tagged templates (`$queryRaw\`…${param}\``, `Prisma.sql`) — `$queryRawUnsafe` is forbidden
- Must include `workspaceId`, must have an integration test

### Listeners and jobs
- Listeners and job processors are idempotent: running twice = running once
- A listener never fails the request that published the event: errors are caught and logged with the request id
- Anything that must happen (emails) is recorded in PostgreSQL in the business transaction; Redis may be wiped at any time (ADR-0027)

---

## 4. Performance Checklist

> Before writing any data-access code, verify ALL items:

- [ ] **Batch processing** — use `createMany`, `updateMany` instead of loops
- [ ] **No N+1 queries** — use Prisma `include` or `select` to preload relations; counters (`replyCount`) and grouped queries (unread counts) instead of per-row counts
- [ ] **Pagination required** — every list endpoint: cursor for messages, offset (limit ≤ 100) for the rest
- [ ] **Select only needed fields** — use Prisma `select` instead of returning full records
- [ ] **Single transaction** — multiple related writes must be in `prisma.$transaction()`
- [ ] **No application cache by default** — add one only for an endpoint that misses its WORKFLOW.md §3 target, with a tenant-prefixed key, invalidation on write, TTL ≤ 60 s, and never for auth state (ADR-0019)
- [ ] **No heavy computation in request cycle** — offload to the queue; jobs stay light (0.1 CPU shared with requests)
- [ ] **Database indexes** — verify index exists for every WHERE/ORDER BY column
- [ ] **Free-tier budgets** — nothing periodic more often than hourly; `/health` never touches the database (WORKFLOW.md §3)
- [ ] **Narrowest socket room** — emit to the channel/board/user room, not the whole workspace (ADR-0025)

### Forbidden Patterns
```typescript
// FORBIDDEN: N+1 query
const users = await this.prisma.user.findMany();
for (const user of users) {
  const tasks = await this.prisma.task.findMany({ where: { assigneeId: user.id } });
}

// CORRECT: single query with include
const users = await this.prisma.user.findMany({
  include: { tasks: true },
});

// FORBIDDEN: loop insert
for (const item of items) {
  await this.prisma.task.create({ data: item });
}

// CORRECT: batch insert
await this.prisma.task.createMany({ data: items });
```

---

## 5. Security Requirements

### Input Validation
- Every public API endpoint must validate input using Zod schemas
- Sanitize all string inputs — strip HTML tags, trim whitespace
- Validate file uploads: verified Cloudinary response, folder of the right tenant, size limit, mime allow-list, no SVG / HTML (ADR-0030)
- URL parameters and query strings must also be validated
- Socket event payloads are validated with Zod like HTTP bodies

### Authentication & Authorization
- JWT access token: 15 minutes expiry, kept in memory (frontend)
- JWT refresh token: 7 days expiry, httpOnly cookie `SameSite=Lax`, rotates on every use, reuse revokes all sessions (Decision #5, ADR-0020)
- `JwtAuthGuard` is global: every route is protected unless marked `@Public()` (Decision #15)
- Routes that read the refresh cookie check `Origin` against `FRONTEND_URL` (ADR-0020)
- Role-based access: check user's role IN THAT WORKSPACE, not global role
- Tokens of any kind (refresh, invitation, reset, verification) are stored as `sha256` hashes only

### Multi-Tenant Isolation (CRITICAL)
- Every database query for tenant data MUST filter by workspaceId (direct column, ADR-0021)
- WorkspaceGuard must run on every workspace-scoped endpoint
- Never trust workspaceId from request body — derive from URL params + verify membership
- Non-members get 404, not 403 (do not reveal existence); members without the role get 403
- Test data isolation: integration tests prove Workspace A cannot read or write Workspace B data, over HTTP **and** sockets

### Real-time (ADR-0025)
- Socket handshake verified like `JwtAuthGuard`; socket disconnected when the access token expires or sessions are revoked
- Joining a room requires the same authorization as the matching HTTP route
- Identity always from `socket.data`, never from the payload
- Private channel data never goes to a workspace-wide room

### Abuse Limits
- Rate limits of ADR-0031 on auth, invitations, messages, uploads and socket events; 429 with `Retry-After`
- `trust proxy` configured so limits apply to the real client IP

### Data Exposure
- Never return raw Prisma models to client — always map to response DTOs
- Never expose: password, tokens or their hashes, internal IDs of other tenants
- Mask sensitive fields in logs: email (h***@gmail.com), tokens (first 8 chars only); pino `redact` for headers, cookies, passwords
- Error responses must not expose stack traces, SQL queries, or internal paths in production
- Every API response sends `Cache-Control: no-store` (ADR-0019)

### Database
- All queries must use Prisma (parameterized by default) — raw SQL only under §3 "Raw SQL"
- Soft delete for the entities listed in ADR-0022; uniqueness among live rows via partial unique indexes
- Composite foreign keys keep children in their parent's workspace (ADR-0021)
- Encrypt sensitive data at rest if required (API keys, webhook secrets)

---

## 6. Error Handling

### Standard Error Response Format (Decision #1)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human readable message",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "timestamp": "2026-01-01T00:00:00.000Z",
  "requestId": "6f1c…"
}
```

### Rules
- Use NestJS built-in exceptions (BadRequestException, NotFoundException, etc.)
- Create custom exceptions for business logic errors (WorkspaceLimitExceededException)
- Global exception filter must catch ALL unhandled errors and format them; Prisma P2002 → 409, P2025 → 404
- Log full error with stack trace and request id on server — return safe message to client
- WebSocket errors use the same fields: in the event's ack (`{ success: false, … }`) or an `exception` event (ADR-0025)

---

## 7. Testing Requirements

Tests are written **before** the code, one slice at a time (§0 Steps 4–5, ADR-0039, skill `tdd`).

### Seams (where tests go)
| Seam | Kind | Location |
|---|---|---|
| HTTP endpoint (primary) | Integration: real app + supertest + test database | `apps/api/test/*.e2e-spec.ts` |
| Socket event | Integration: real app + `socket.io-client` | `apps/api/test/*.e2e-spec.ts` |
| Pure logic (rules, mappers, utils, schemas, position maths) | Unit | `src/**/__tests__/*.spec.ts` |
| Database guarantee (hash only, cascade, constraint) | Integration at the repository | `apps/api/test/*.repository.e2e-spec.ts` |
| Frontend | Vitest + Testing Library; Playwright (M7) | `apps/web` (§11) |

A service is tested through its endpoint. A unit test for a service is written only for a branch HTTP cannot reach, mocking only system boundaries. The seams of a branch are approved in its plan.

### Minimum Coverage
- Every API endpoint must have integration tests for its success path and its main error paths
- Every socket event must have an integration test with `socket.io-client`
- Every piece of pure logic must have unit tests
- Critical flows must have E2E tests: auth, workspace creation, invitations, messaging, task moves
- Every workspace feature: an **isolation test** (another tenant gets 404 and no socket events)
- Every rule of ADR-0032: a **concurrency test** (two competing requests with `Promise.all`)
- Every listener and job: an **idempotency test** (run twice, same result)

### Test Naming
```typescript
describe('POST /workspaces/:workspaceId/invitations', () => {
  it('should create a Pending invitation when the caller is an Admin', async () => {});
  it('should return 403 when the caller has the Member role', async () => {});
  it('should return 404 when the caller is not a Member', async () => {});
});
```
Names describe behaviour in `GLOSSARY.md` terms, not implementation ("calls repository.create").

### Rules
- Red before green: see the new test fail for the expected reason before writing the code
- Tests must not depend on each other — each test sets up its own data
- Use factories for test data — no hardcoded objects repeated across tests
- Expected values are literals or come from the spec — never recomputed the way the code computes them
- **Mock only system boundaries:** time, bcrypt, Cloudinary, the mail adapter (Resend), the queue. Never mock repositories, services, guards, Prisma or the database in new tests. Existing M1 tests that mock repositories stay until a refactor breaks them; then replace them with an endpoint test
- Never call real external APIs in tests; locally, emails go to Mailpit
- Integration tests must use a real test database — not mocked Prisma
- Check through the interface, not the database, unless the behaviour is a database guarantee (see Seams)
- Compare timestamps as instants (`getTime()`), not strings (ADR-0023)
- Frontend: Vitest + Testing Library for hooks and critical components; Playwright for end-to-end flows (§11)

---

## 8. Git Rules

### Commit Messages
```
feat(workspace): add member invitation flow
fix(auth): refresh token rotation not invalidating old token
refactor(tasks): extract position calculation to utility
test(channels): add integration tests for CRUD endpoints
docs: update API documentation for workspace endpoints
chore: update dependencies
```

### Branch Naming
```
feature/workspace-invitation
fix/auth-refresh-token
refactor/task-ordering
chore/deploy-pipeline
```

### Rules
- One feature per branch — never mix unrelated changes
- Commit often with meaningful messages
- Every PR must pass: lint, type check, all tests, `openapi.json` up to date
- Never commit: .env, node_modules, dist/, .DS_Store, generated clients

---

## 9. API Design

### URL Pattern
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/:workspaceId
PATCH  /api/v1/workspaces/:workspaceId
DELETE /api/v1/workspaces/:workspaceId

GET    /api/v1/workspaces/:workspaceId/channels
POST   /api/v1/workspaces/:workspaceId/channels
GET    /api/v1/workspaces/:workspaceId/channels/:channelId/messages
```

### Rules
- Always prefix with /api/v1/ — allows future versioning
- Use plural nouns for resources
- Nested routes for tenant-scoped resources (workspace → channels → messages)
- Use PATCH for partial updates, PUT for full replacement
- List endpoints must support pagination (offset `page`/`limit`, or cursor `before`/`after` for messages), and filtering where the spec lists it
- Return 201 for created, 200 for success, 204 for delete
- Tokens (invitation, reset) travel in the POST body, never in an API URL
- Breaking changes follow expand → migrate → contract: the deployed frontend must keep working (ADR-0033, ADR-0036)

---

## 10. Pre-Generation Checklist

> Before generating ANY code, you MUST verify:

1. [ ] Read this RULE.md file and the ADRs listed for the milestone
2. [ ] Identify which module this code belongs to
3. [ ] Check if similar code already exists — avoid duplication
4. [ ] Plan the data flow: Controller → Service → Repository, plus events published / consumed
5. [ ] Identify all Zod schemas needed for validation
6. [ ] Identify all database queries — check for N+1, missing indexes, missing workspaceId
7. [ ] Identify error cases, race conditions and how to handle them
8. [ ] Identify what tests are needed (unit, integration, isolation, concurrency, socket)
9. [ ] Review generated code against ALL sections of this file
10. [ ] Verify no `any`, no raw Prisma models in response, every route guarded or `@Public()`, events emitted after commit to authorized rooms only

---

## 11. Frontend Rules (`apps/web`, ADR-0034)

### Folder Structure
```
src/
├── app/                       # Router, providers, layouts, guards, error page, query client
├── api/
│   ├── generated/             # Client, hooks and Zod schemas from openapi.json (gitignored)
│   └── http.ts                # HTTP client: credentials, Bearer, 401 → refresh → retry once, ApiError
├── features/
│   └── <feature>/             # auth, workspaces, channels, messages, boards, notifications
│       ├── components/
│       ├── hooks/             # Feature hooks built on the generated query hooks
│       ├── routes/            # Pages of this feature
│       └── __tests__/
├── realtime/                  # Socket connection, event names, event → cache handlers
├── shared/
│   ├── ui/                    # Reusable presentational components
│   └── lib/                   # Pure helpers (formatting dates in local time, cursors…)
├── test/                      # Test setup, MSW server, fixtures, render with providers
└── main.tsx                   # Boot refresh (once, before render), then render
```

### State
- Server data lives **only** in TanStack Query. Never copy it into Zustand or component state
- Zustand only for client state not in the URL: access token (memory only, never persisted), socket status, UI preferences
- Workspace / channel / board ids come from the URL (`/w/:workspaceId/c/:channelId`, `/w/:workspaceId/b/:boardId`)

### Data and Real-time
- Use the generated client and hooks; never hand-write request or response types for REST
- Socket events are handled in `src/realtime/` only, which updates the query cache (`setQueryData` for created/updated/deleted, `invalidateQueries` when unsure). Components never subscribe to the socket
- Deduplicate by id; ignore updates older than the cached `updatedAt`; resync after reconnect (ADR-0025)
- Optimistic message send with `clientMessageId` (ADR-0024)

### Auth
- On start: `POST /auth/refresh` once to restore the session
- On 401: one refresh in flight at a time (single flight), then retry once; if refresh fails, clear memory and query cache and go to login
- Never store tokens in `localStorage` or `sessionStorage`

### Security
- No `dangerouslySetInnerHTML`. Messages are plain text; links and mention tokens are rendered by components
- Remove tokens from the address bar right after reading them (`/invite?token=…`, reset, verify)
- Security headers and CSP in `vercel.json`

### UI
- Every screen handles loading, empty and error states
- Forms: React Hook Form + generated Zod schemas; server validation errors (`details[]`) mapped to fields
- Dates shown in the user's local time zone; sent as UTC ISO strings
- Same code style rules as §2 (strict TypeScript, no `any`, functions ≤ 30 lines, async/await)

### Testing
- Vitest + Testing Library for hooks and critical components (forms, refresh flow, realtime handlers)
- Playwright for end-to-end critical flows (M7)
