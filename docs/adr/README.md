# Architecture Decision Records

One file per decision: the context, what was decided, and what it costs. Read the relevant ADRs before working on a feature. They override any conflicting text in WORKFLOW.md and RULE.md (and those files are corrected when an ADR changes them).

## Rules

- **Numbering.** `NNNN-short-title.md`. ADR-0001 … ADR-0017 are the "Resolved Decisions #1–#17" from Milestone 1, with the same numbers, so code comments like `Decision #5` still point to the right record.
- **Never rewrite history.** An ADR becomes immutable **once it is merged into `main`**. From then on, to change a decision, write a new ADR and set the old one's status to `Superseded by ADR-XXXX` or `Amended by ADR-XXXX`. Typos and broken links may be fixed in place. Before the merge, the ADR is still a draft under review and is edited directly.
- **Status values:** `Proposed`, `Accepted`, `Deferred to <milestone>`, `Amended by …`, `Superseded by …`.
- **When to write one:** the decision is **hard to reverse**, **surprising without context** (a newcomer would ask "why this way?"), **and the result of a real trade-off** — all three. Or it resolves a conflict between project documents, which must be recorded so the documents can be corrected. Otherwise, skip the ADR.
- **Short is fine.** Context and Decision are required. Alternatives and Consequences only when they add value.
- **After writing one:** add it to the index below and to the summary table in `CLAUDE.md`.

## Template

```markdown
# ADR-NNNN: Title in the imperative or as a statement

- **Status:** Accepted
- **Date:** YYYY-MM-DD

## Context
What forces the decision. Numbers if any (WORKFLOW.md §3 NFR).

## Decision
What we do. Concrete enough to check in a code review.

## Alternatives considered          (optional)
| Option | Rejected because |

## Consequences                     (optional)
What becomes easier, what becomes harder, what must be revisited and when.
```

The agent skill `domain-modeling` (`.claude/skills/domain-modeling/`) follows these rules when it proposes or writes an ADR.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-error-response-format.md) | Error responses include `success: false` | Accepted |
| [0002](0002-prisma-file-location.md) | Prisma files live in `apps/api/prisma/` | Accepted |
| [0003](0003-docker-compose-infrastructure-only.md) | Docker Compose runs infrastructure only | Accepted |
| [0004](0004-users-soft-delete.md) | `users` has `deletedAt` | Accepted |
| [0005](0005-refresh-token-storage.md) | Refresh token: httpOnly cookie, hashed, reuse revokes all | Accepted, amended by 0020 |
| [0006](0006-password-hashing-bcryptjs.md) | Password hashing with `bcryptjs`, cost 10 | Accepted, re-measure in M2 |
| [0007](0007-validation-zod.md) | Validation with Zod through `nestjs-zod` | Accepted |
| [0008](0008-websocket-event-names.md) | WebSocket event names | Superseded by 0025 |
| [0009](0009-kanban-position-type.md) | Kanban `position` type | Deferred to M5 |
| [0010](0010-bull-vs-bullmq.md) | Bull vs BullMQ | Superseded by 0027 |
| [0011](0011-package-versions.md) | Package versions | Accepted |
| [0012](0012-prisma-7-specifics.md) | Prisma 7 configuration | Accepted, amended by 0036 |
| [0013](0013-response-shaping-zod-response.md) | `@ZodResponse` on every endpoint | Accepted |
| [0014](0014-jest-commonjs.md) | Jest runs CommonJS | Accepted |
| [0015](0015-custom-jwt-guard.md) | Custom global JWT guard, no Passport | Accepted |
| [0016](0016-deferred-password-reset-and-rate-limit.md) | Password reset and rate limiting deferred | Amended by 0031, 0037 |
| [0017](0017-users-auth-module-boundaries.md) | Module boundaries between auth and users | Accepted |

### System design review (2026-11-21)

Grouped by the system design area they answer. The numbers they rely on are in WORKFLOW.md §3 "Non-Functional Requirements & Capacity Budget".

| ADR | Title | Area | Status |
|---|---|---|---|
| [0018](0018-modular-monolith-single-instance.md) | Modular monolith, one process, one instance | Architecture, Scaling | Accepted |
| [0019](0019-region-colocation-no-cache.md) | One region; no application cache until measured | Foundations, Scaling | Accepted |
| [0020](0020-same-origin-proxy-cookie-csrf.md) | Same-origin proxy, `SameSite=Lax` cookie, Origin check | Security | Accepted |
| [0021](0021-tenant-key-on-every-table.md) | `workspaceId` on every tenant table + composite FKs | Data, Security | Accepted |
| [0022](0022-soft-delete-and-uniqueness.md) | Soft-delete policy, partial unique indexes, invitation lifecycle | Data | Accepted |
| [0023](0023-timestamptz-utc.md) | Every timestamp is `timestamptz` (UTC) | Data | Accepted |
| [0024](0024-messaging-data-model.md) | Messaging: cursor, threads, unread, limits, idempotency, raw SQL | Data, Communication | Accepted |
| [0025](0025-realtime-design.md) | Real-time: auth lifecycle, rooms, events, resync | Communication, Security | Accepted |
| [0026](0026-domain-events-after-commit.md) | Domain events after commit; consistency levels | Communication, Reliability | Accepted |
| [0027](0027-background-jobs-bullmq-disposable-redis.md) | BullMQ on Render Key Value; Redis is disposable | Reliability, Scaling | Accepted |
| [0028](0028-deadline-reminders-hourly-scan.md) | Deadline reminders by hourly scan | Reliability | Accepted |
| [0029](0029-email-delivery.md) | Email via HTTP API, Mailpit locally, verification | Shipping, Security | Accepted (domain open) |
| [0030](0030-file-uploads.md) | Signed direct uploads, private attachments | Data, Security | Accepted |
| [0031](0031-rate-limiting-before-deploy.md) | Rate and abuse limits before the API is public | Security, Reliability | Accepted |
| [0032](0032-concurrency-rules.md) | Concurrency rules | Reliability | Accepted |
| [0033](0033-api-contract-openapi-codegen.md) | Frontend ↔ backend contract via OpenAPI codegen | Architecture | Accepted |
| [0034](0034-frontend-architecture.md) | Frontend architecture | Architecture | Accepted |
| [0035](0035-observability.md) | Logs, request id, error tracking, health endpoints | Shipping, Reliability | Accepted |
| [0036](0036-delivery-pipeline-and-database-operations.md) | CI/CD, migrations, two DB URLs, expand–contract | Shipping | Accepted |
| [0037](0037-vertical-slice-milestones.md) | Vertical-slice milestones, deployed from M2 | Whole system | Accepted |
| [0038](0038-documentation-sources-of-truth.md) | One source of truth per topic | Whole system | Accepted |

### Agent skills and development flow (2026-11-21)

| ADR | Title | Status |
|---|---|---|
| [0039](0039-test-first-at-agreed-seams.md) | Test first, at seams agreed in the plan | Accepted |
