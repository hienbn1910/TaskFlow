# ADR-0021: `workspaceId` on every tenant table, enforced by composite foreign keys

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- RULE.md §3 and §5 require `workspaceId` in every tenant query.
- The planned schema had it only on `workspaces`' direct children (`channels`, `boards`, `invitations`, `workspace_members`). `messages`, `channel_members`, `message_attachments`, `board_columns` and `tasks` reached the workspace only through joins. The rule was then either a multi-level join in every query, or easy to forget.
- Nothing in the database prevented a message from pointing to a channel of another workspace.

## Decision
1. Every table holding workspace data has a **non-null `workspaceId`**: `workspace_members`, `invitations`, `channels`, `channel_members`, `messages`, `message_attachments`, `boards`, `board_columns`, `tasks`. `notifications.workspaceId` stays nullable (notifications belong to a user).
2. **Composite foreign keys** make the database refuse cross-tenant links:
   - the parent declares `@@unique([workspaceId, id])`;
   - the child references `(workspaceId, parentId)` → parent `(workspaceId, id)`.
   Example: `messages(workspaceId, channelId)` → `channels(workspaceId, id)`.
3. `tasks` also carries `boardId` (board-wide filters without a join). `(boardId, columnId)` → `board_columns(boardId, id)` guarantees the column belongs to the task's board.
4. Repositories filter tenant data with `workspaceId` **as a direct column**, never through a relation.
5. Indexes follow the access path (e.g. `messages(channelId, parentId, createdAt, id)`). `workspaceId` does not need to lead every index: the parent id already implies the tenant.

## Alternatives considered
| Option | Rejected because |
|---|---|
| Joins through parents | Long queries; one missed hop leaks data; impossible to check in review |
| PostgreSQL Row-Level Security | Strongest, but needs `SET app.workspace_id` per transaction, which fights PgBouncer pooling and Prisma. Noted as future hardening |

## Consequences
- 16 redundant bytes per row. In exchange, a code bug cannot create cross-tenant links: the insert fails.
- Moving an entity to another workspace is not supported (not a feature).
- Cross-tenant integration tests stay mandatory (RULE.md §5): the FK protects writes, tests protect reads.
