# Architecture Decision Records

One file per decision: the context, what was decided, and what it costs. Read the relevant ADRs before working on a feature. They override any conflicting text in WORKFLOW.md and RULE.md (and those files are corrected when an ADR changes them).

## Rules

- **Numbering.** `NNNN-short-title.md`. ADR-0001 … ADR-0017 are the "Resolved Decisions #1–#17" from Milestone 1, with the same numbers, so code comments like `Decision #5` still point to the right record.
- **Never rewrite history.** To change a decision, write a new ADR and set the old one's status to `Superseded by ADR-XXXX` or `Amended by ADR-XXXX`. Typos and broken links may be fixed in place.
- **Status values:** `Proposed`, `Accepted`, `Deferred to <milestone>`, `Amended by …`, `Superseded by …`.
- **When to write one:** a choice between real alternatives that a newcomer would question, that is costly to reverse, or that resolves a conflict between project documents.
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

## Alternatives considered
| Option | Rejected because |

## Consequences
What becomes easier, what becomes harder, what must be revisited and when.
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-error-response-format.md) | Error responses include `success: false` | Accepted |
| [0002](0002-prisma-file-location.md) | Prisma files live in `apps/api/prisma/` | Accepted |
| [0003](0003-docker-compose-infrastructure-only.md) | Docker Compose runs infrastructure only | Accepted |
| [0004](0004-users-soft-delete.md) | `users` has `deletedAt` | Accepted |
| [0005](0005-refresh-token-storage.md) | Refresh token: httpOnly cookie, hashed, reuse revokes all | Accepted, amended |
| [0006](0006-password-hashing-bcryptjs.md) | Password hashing with `bcryptjs`, cost 10 | Accepted, re-measure |
| [0007](0007-validation-zod.md) | Validation with Zod through `nestjs-zod` | Accepted |
| [0008](0008-websocket-event-names.md) | WebSocket event names | Superseded |
| [0009](0009-kanban-position-type.md) | Kanban `position` type | Deferred to M5 |
| [0010](0010-bull-vs-bullmq.md) | Bull vs BullMQ | Superseded |
| [0011](0011-package-versions.md) | Package versions | Accepted |
| [0012](0012-prisma-7-specifics.md) | Prisma 7 configuration | Accepted, amended |
| [0013](0013-response-shaping-zod-response.md) | `@ZodResponse` on every endpoint | Accepted |
| [0014](0014-jest-commonjs.md) | Jest runs CommonJS | Accepted |
| [0015](0015-custom-jwt-guard.md) | Custom global JWT guard, no Passport | Accepted |
| [0016](0016-deferred-password-reset-and-rate-limit.md) | Password reset and rate limiting deferred | Amended |
| [0017](0017-users-auth-module-boundaries.md) | Module boundaries between auth and users | Accepted |
