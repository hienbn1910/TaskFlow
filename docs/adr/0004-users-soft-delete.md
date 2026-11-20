# ADR-0004: `users` has `deletedAt`

- **Status:** Accepted (extended by ADR-0022: email unique only among non-deleted users)
- **Date:** 2026-11 (Milestone 1)

## Context
RULE.md §5 requires soft delete for users. The WORKFLOW.md `users` table had no `deletedAt`.

## Decision
Add `deletedAt` to `users`. A user with `deletedAt` set cannot sign in (`canSignIn`, Decision #17).

## Consequences
Every user lookup filters out deleted users. Email uniqueness must ignore deleted rows (ADR-0022).
