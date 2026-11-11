# TaskFlow

A multi-tenant SaaS collaboration platform built with NestJS, React, and TypeScript. Teams create isolated workspaces, talk in real-time messaging channels, manage tasks on Kanban boards, and share files, with role-based access control and WebSocket-powered live updates.

> **Status:** early development. The backend foundation is done; authentication is next. See [Roadmap](#roadmap) for what works today and what is planned.

## Tech stack

| Layer | Technology |
|---|---|
| API | NestJS 11, TypeScript 5.9 (strict) |
| Database | PostgreSQL 16, Prisma 7 |
| Validation | Zod 4 via `nestjs-zod` (requests, responses, and environment variables) |
| Cache / queues | Redis (planned: background jobs) |
| Real-time | Socket.io (planned) |
| Frontend | React, Vite, TanStack Query, Zustand (planned) |
| Testing | Jest, Supertest |
| Tooling | pnpm workspaces, ESLint (`strictTypeChecked`), Prettier, Docker Compose |

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| 1. Foundation + Auth | Project setup, config, error handling, JWT auth, user profile | 🚧 In progress: foundation done, auth next |
| 2. Workspaces & Members | Workspaces, roles, invitations | Planned |
| 3. Channels & Messaging | Real-time channels, messages, attachments | Planned |
| 4. Kanban Board | Boards, columns, drag-and-drop tasks | Planned |
| 5. Notifications & Jobs | Notifications, email, deadline reminders | Planned |
| 6. Frontend | React SPA | Planned |
| 7. Testing & Polish | Coverage, rate limiting, performance | Planned |
| 8. Deploy & Docs | Render (API), Vercel (web), Neon, Upstash | Planned |

The full plan, database schema and API design are in [WORKFLOW.md](WORKFLOW.md).

## What is built so far

- **Fail-fast configuration:** every environment variable is validated with Zod at startup. The app refuses to boot with a missing or invalid value, and error messages show variable names only, never values. Sample secrets from `.env.example` are rejected in production.
- **Standard response format:** controllers return plain data; a global interceptor wraps it as `{ success, data }`, and a global exception filter turns every error into the same shape.
- **Safe error handling:** unknown errors become a generic 500, so stack traces, SQL and internal paths never reach the client. Emails and tokens are masked in logs.
- **Response whitelisting:** each endpoint declares a Zod response schema, and fields outside it (such as `password`) are stripped before the response is sent.
- **Security headers and CORS:** `helmet`, and CORS limited to the configured frontend origin.
- **Health check and API docs:** `GET /api/v1/health` and Swagger UI at `/api/docs`.

### Response format

```jsonc
// Success
{ "success": true, "data": { "status": "ok", "timestamp": "2026-11-11T08:00:00.000Z" } }

// Error
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "details": [{ "field": "email", "message": "Invalid email address" }],
  "timestamp": "2026-11-11T08:00:00.000Z"
}
```

## Getting started

### Prerequisites

- Node.js 22 or later
- pnpm 12 (`corepack enable` picks the version pinned in `package.json`)
- Docker Desktop (runs PostgreSQL and Redis)

### Setup

1. **Clone and install.** `pnpm install` also generates the Prisma client.

   ```bash
   git clone https://github.com/hienbn1910/TaskFlow.git
   cd TaskFlow
   pnpm install
   ```

2. **Create the environment files.**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/api/.env.example apps/api/.env.test
   ```

   In `apps/api/.env.test`, change these two lines so tests use the separate test database:

   ```env
   NODE_ENV=test
   DATABASE_URL=postgresql://taskflow:taskflow123@localhost:5433/taskflow_test
   ```

   The sample values work as-is for local development. **Never use them in production:** the app rejects the sample JWT secrets when `NODE_ENV=production`.

3. **Start PostgreSQL and Redis.**

   ```bash
   docker compose up -d
   ```

   This starts three containers, all bound to `127.0.0.1` only:

   | Service | Port | Purpose |
   |---|---|---|
   | `postgres` | 5432 | Development database (data kept in a Docker volume) |
   | `postgres-test` | 5433 | Test database (in memory, wiped on restart) |
   | `redis` | 6379 | Cache and queues |

4. **Apply database migrations.**

   ```bash
   pnpm --filter api db:migrate        # development database
   pnpm --filter api db:migrate:test   # test database
   ```

   The test database lives in memory, so run `db:migrate:test` again after restarting its container.

5. **Run the API.**

   ```bash
   pnpm dev
   ```

   - Health check: http://localhost:3000/api/v1/health
   - API docs: http://localhost:3000/api/docs

## Scripts

Run from the repository root:

| Command | Description |
|---|---|
| `pnpm dev` | Start the API in watch mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint with zero warnings allowed |
| `pnpm typecheck` | Type-check source and test files |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests against the test database (Docker must be running) |
| `pnpm format` | Format code with Prettier |

API-only commands, run with `pnpm --filter api <command>`:

| Command | Description |
|---|---|
| `db:migrate` | Create and apply migrations on the development database |
| `db:migrate:test` | Apply migrations to the test database |
| `db:generate` | Regenerate the Prisma client after changing `schema.prisma` |
| `test:cov` | Run unit tests with a coverage report |

Before opening a pull request, all four checks must pass:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

## Project structure

```
taskflow/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/             # schema.prisma and migrations
│   │   ├── src/
│   │   │   ├── common/         # Filters, interceptors, decorators, utilities
│   │   │   ├── config/         # Zod-validated environment config
│   │   │   ├── modules/        # Feature modules (health, then auth, workspace, ...)
│   │   │   ├── prisma/         # PrismaService and PrismaModule
│   │   │   └── main.ts
│   │   └── test/               # End-to-end tests
│   └── web/                    # React frontend (not started)
├── docker-compose.yml          # PostgreSQL (dev + test) and Redis
├── RULE.md                     # Coding standards and development flow
├── WORKFLOW.md                 # Project plan, schema, API and milestones
└── CLAUDE.md                   # Instructions and recorded decisions for AI agents
```

## Troubleshooting

- **`Could not locate module @prisma-client/client`:** the generated Prisma client is missing (it is not committed). Run `pnpm --filter api db:generate`.
- **App exits with `Invalid environment variables`:** the message lists each variable that is missing or invalid. Compare your `.env` with `.env.example`.
- **E2E tests cannot connect to the database:** make sure Docker Desktop is running, then run `docker compose up -d` and `pnpm --filter api db:migrate:test`.

## Documentation

- [RULE.md](RULE.md): coding standards, architecture rules, security and performance checklists
- [WORKFLOW.md](WORKFLOW.md): database schema, API endpoints, WebSocket events, milestones
- [WORKFLOW-VI.md](WORKFLOW-VI.md): Vietnamese translation with a glossary
- [CLAUDE.md](CLAUDE.md): decisions that resolve conflicts between the documents above

## License

[MIT](LICENSE)
