# ADR-0032: Concurrency rules

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
The plan did not say what happens when two requests race: an invitation accepted twice, the last owner leaving, two people editing the same task, two workspaces created with the same slug.

## Decision
1. **Uniqueness lives in the database.** Never "check then insert" without a unique constraint behind it. A violation (P2002) becomes 409 (already mapped by the global filter). Auto-generated slugs retry with a random suffix, at most 3 times.
2. **Accepting an invitation** runs in one transaction:
   `updateMany({ where: { id, status: PENDING, expiresAt > now }, data: { status: ACCEPTED } })` must affect exactly 1 row, then the member is created. `UNIQUE (workspaceId, userId)` stops a double join.
3. **Exactly one owner per workspace** (`workspaces.ownerId` + role `OWNER`).
   - The owner cannot leave, be removed or be demoted.
   - `POST /workspaces/:workspaceId/transfer-ownership` (owner only) swaps roles and `ownerId` in one transaction.
   - An ADMIN manages MEMBERs only. The OWNER manages everyone.
4. **Concurrent edits** (task, channel, workspace settings): last write wins. Every write is broadcast, so other viewers converge to the final state. Optimistic locking (`version` column) is not used: it costs every update path for a rare conflict in a small-team tool. Revisit if lost edits are reported.
5. **Message send:** idempotent through `clientMessageId` (ADR-0024).
6. **Kanban moves:** row locks in one transaction (ADR-0009).

## Consequences
Each rule above gets an integration test that runs the two competing requests with `Promise.all` and checks the outcome.
