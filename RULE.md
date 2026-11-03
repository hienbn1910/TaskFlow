# Project Rules — WorkSpace SaaS Platform

> Every code generation must read and follow this file before writing any code.

---

## 0. Development Flow
> Every feature must go through all the steps below. No steps can be skipped.

```
[Spec] → [Plan] → [AI Agent decompose task] → [Generate Code] → [Generate Tests] → [Run Tests] → [Fix] → [Check Performance/Security] → [Refactor] → [PR]
```

### Step 1: Spec (Specification)
- Clearly describe the feature's requirements, inputs/outputs, and edge cases.
- Define the scope: identify affected endpoints, modules, and database tables.
- List the acceptance criteria.
### Step 2: Plan
- Define the data flow: Controller → Service → Repository.
- List the files that need to be created or modified.
- Identify the necessary Zod schemas, DTOs, and entity mappings.
- Determine dependencies on other modules.
### Step 3: Task Decomposition (by AI Agent)
- Break the feature down into smaller tasks, each capable of being generated independently.
- Order tasks based on dependencies (Repository → Service → Controller → Tests).
- Provide a clear description for each task: target file, function, and required logic.
### Step 4: Code Generation
- The AI ​​must read `RULE.md` before writing any code.
- Generate code following the established dependency order.
- Ensure every file adheres to the defined folder structure and architectural rules.
### Step 5: Test Generation
- Write unit tests for all service methods.
- Write integration tests for all endpoints.
- Ensure tests cover both the "happy path" and error scenarios.
### Step 6: Test Execution
- Run the entire test suite—not just the new tests.
- Ensure no existing tests are broken (prevent regressions).
### Step 7: Fix
- Resolve any failing tests.
- If a fix impacts other logic, return to Step 6.
### Step 8: Performance/Security Check
- Verify against the Performance Checklist (Section 4).
- Verify against Security Requirements (Section 5).
- Crucially: ensure all queries include `workspaceId` and that raw Prisma models are not exposed.
### Step 9: Refactor
- Eliminate redundant code.
- Ensure functions are ≤ 30 lines long and have ≤ 3 parameters.
- Maintain consistent naming conventions.
- Verify the order of imports.
### Step 10: PR (Pull Request)
- Follow the commit message format specified in Section 8
- Provide a clear description of the changes in the PR description
- Ensure that linting, type checking, and all tests pass

## 1. Folder Structure

```
src/
├── common/
│   ├── decorators/            # Custom decorators (@CurrentUser, @WorkspaceId, @Roles)
│   ├── filters/               # Exception filters (global, http, ws)
│   ├── guards/                # Auth, Role, Workspace guards
│   ├── interceptors/          # Response transform, logging, timeout
│   ├── pipes/                 # Zod validation pipe
│   ├── middleware/             # Tenant, logger, cors middleware
│   ├── constants/             # Enums, error codes, config keys
│   ├── types/                 # Shared TypeScript types/interfaces
│   └── utils/                 # Pure helper functions (no side effects)
├── config/
│   ├── app.config.ts          # Validated env config using Zod
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── jwt.config.ts
│   └── index.ts
├── modules/
│   ├── <feature>/
│   │   ├── <feature>.controller.ts
│   │   ├── <feature>.service.ts
│   │   ├── <feature>.repository.ts
│   │   ├── <feature>.module.ts
│   │   ├── dto/               # Request/Response DTOs with Zod schemas
│   │   │   ├── create-<feature>.dto.ts
│   │   │   ├── update-<feature>.dto.ts
│   │   │   └── <feature>-response.dto.ts
│   │   ├── entities/          # Prisma-mapped types (NOT raw Prisma types)
│   │   └── __tests__/
│   │       ├── <feature>.service.spec.ts
│   │       └── <feature>.controller.spec.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── app.module.ts
└── main.ts
```

### Rules:
- One module per feature — never mix features in one module
- Every module must have its own dto/ folder — no shared DTOs between modules
- If two modules need the same DTO, extract it to common/types/
- Test files live next to the code they test, inside __tests__/
- No circular dependencies between modules — if A needs B and B needs A, extract shared logic to a new module

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
Files:          kebab-case          → create-workspace.dto.ts
Classes:        PascalCase          → WorkspaceService
Interfaces:     PascalCase (no I)   → WorkspaceRepository (not IWorkspaceRepository)
Functions:      camelCase           → findByWorkspaceId()
Variables:      camelCase           → workspaceMembers
Constants:      UPPER_SNAKE_CASE    → MAX_FILE_SIZE
Enums:          PascalCase          → MemberRole.ADMIN
DB columns:     camelCase in Prisma → maps to snake_case in PostgreSQL
API endpoints:  kebab-case          → /api/v1/workspace-members
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
import { PrismaService } from '@prisma/client';

// 2. Common/shared modules
import { WorkspaceGuard } from '@common/guards';

// 3. Same module imports
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
```

---

## 3. Architecture Rules

### Controller
- ONLY handles HTTP concerns: parse request, call service, return response
- No business logic — not even simple if/else conditions
- Must use DTOs for both input validation and response shaping
- Must use decorators for auth, roles, workspace context

```typescript
// GOOD
@Post()
async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: UserEntity) {
  return this.workspaceService.create(dto, user.id);
}

// BAD — business logic in controller
@Post()
async create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: UserEntity) {
  const existing = await this.prisma.workspace.findFirst({ where: { slug: dto.slug } });
  if (existing) throw new ConflictException();
  // ...
}
```

### Service
- Contains ALL business logic
- Calls repository for data access — never calls Prisma directly
- Must validate business rules before performing actions
- Returns mapped DTOs/entities — never raw Prisma models

### Repository
- ONLY handles database queries
- No business logic — no if/else based on business rules
- Must use Prisma parameterized queries (never raw string interpolation)
- Every query for tenant-scoped data MUST include workspaceId filter

```typescript
// GOOD
async findTasks(workspaceId: string, filters: TaskFilters) {
  return this.prisma.task.findMany({
    where: { board: { workspaceId }, ...filters },
  });
}

// BAD — missing workspaceId = data leak across tenants
async findTasks(filters: TaskFilters) {
  return this.prisma.task.findMany({ where: filters });
}
```

---

## 4. Performance Checklist

> Before writing any data-access code, verify ALL items:

- [ ] **Batch processing** — use `createMany`, `updateMany` instead of loops
- [ ] **No N+1 queries** — use Prisma `include` or `select` to preload relations
- [ ] **Pagination required** — every list endpoint must support cursor or offset pagination
- [ ] **Select only needed fields** — use Prisma `select` instead of returning full records
- [ ] **Single transaction** — multiple related writes must be in `prisma.$transaction()`
- [ ] **Caching for read-heavy data** — workspace settings, user profile, channel list
- [ ] **No heavy computation in request cycle** — offload to Bull queue
- [ ] **Database indexes** — verify index exists for every WHERE/ORDER BY column

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
- Validate file uploads: size limit, mime type whitelist, filename sanitize
- URL parameters and query strings must also be validated

### Authentication & Authorization
- JWT access token: 15 minutes expiry, stored in memory (frontend)
- JWT refresh token: 7 days expiry, stored in httpOnly cookie
- Refresh token must rotate on every use — invalidate old token
- Every endpoint must have @UseGuards(JwtAuthGuard) unless explicitly public
- Role-based access: check user's role IN THAT WORKSPACE, not global role

### Multi-Tenant Isolation (CRITICAL)
- Every database query for tenant data MUST filter by workspaceId
- WorkspaceGuard must run on every workspace-scoped endpoint
- Never trust workspaceId from request body — derive from URL params + verify membership
- Test data isolation: write integration tests that verify Workspace A cannot access Workspace B data

### Data Exposure
- Never return raw Prisma models to client — always map to response DTOs
- Never expose: password, refresh tokens, internal IDs of other tenants
- Mask sensitive fields in logs: email (h***@gmail.com), tokens (first 8 chars only)
- Error responses must not expose stack traces, SQL queries, or internal paths in production

### Database
- All queries must use Prisma (parameterized by default) — no raw SQL string interpolation
- Soft delete for critical entities (workspace, channel, user) — add `deletedAt` column
- Encrypt sensitive data at rest if required (API keys, webhook secrets)

---

## 6. Error Handling

### Standard Error Response Format
```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human readable message",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Rules
- Use NestJS built-in exceptions (BadRequestException, NotFoundException, etc.)
- Create custom exceptions for business logic errors (WorkspaceLimitExceededException)
- Global exception filter must catch ALL unhandled errors and format them
- Log full error with stack trace on server — return safe message to client
- WebSocket errors must also follow the same format

---

## 7. Testing Requirements

### Minimum Coverage
- Every service method must have at least one unit test
- Every API endpoint must have at least one integration test
- Critical flows must have E2E tests: auth, workspace creation, messaging

### Test Naming
```typescript
describe('WorkspaceService', () => {
  describe('create', () => {
    it('should create workspace with valid data', async () => {});
    it('should throw ConflictException when slug already exists', async () => {});
    it('should set creator as OWNER role', async () => {});
  });
});
```

### Rules
- Tests must not depend on each other — each test sets up its own data
- Use factories for test data — no hardcoded objects repeated across tests
- Mock external services (email, file upload) — never call real APIs in tests
- Integration tests must use a real test database — not mocked Prisma

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
```

### Rules
- One feature per branch — never mix unrelated changes
- Commit often with meaningful messages
- Every PR must pass: lint, type check, all tests
- Never commit: .env, node_modules, dist/, .DS_Store

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
- List endpoints must support: pagination, sorting, filtering
- Return 201 for created, 200 for success, 204 for delete

---

## 10. Pre-Generation Checklist

> Before generating ANY code, you MUST verify:

1. [ ] Read this RULE.md file
2. [ ] Identify which module this code belongs to
3. [ ] Check if similar code already exists — avoid duplication
4. [ ] Plan the data flow: Controller → Service → Repository
5. [ ] Identify all Zod schemas needed for validation
6. [ ] Identify all database queries — check for N+1, missing indexes, missing workspaceId
7. [ ] Identify error cases and how to handle them
8. [ ] Identify what tests are needed
9. [ ] Review generated code against ALL sections of this file
10. [ ] Verify no `any`, no raw Prisma models in response, no missing auth guards
