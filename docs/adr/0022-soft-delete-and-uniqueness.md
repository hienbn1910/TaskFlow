# ADR-0022: Soft-delete policy, partial unique indexes, invitation lifecycle

- **Status:** Accepted (extends Decision #4; amended 2026-11-22: partial indexes declared in `schema.prisma`)
- **Date:** 2026-11-21

## Context
- A soft-deleted row keeps its unique values. Today a user who deleted their account can never register again with the same email. The same would hold for channel names. (Workspaces have no slug: their name need not be unique, and URLs use ids, ADR-0034.)
- `invitations` had `UNIQUE (workspaceId, email)`: an address could never be invited again after an accepted, expired or cancelled invitation.
- Cancelling an invitation had no status. The token was stored in plain text.

## Decision

### Delete kind per entity
| Entity | Delete | Notes |
|---|---|---|
| `users` | Soft (`deletedAt`) | Cannot sign in (Decision #4) |
| `workspaces` | Soft | WorkspaceGuard rejects a deleted workspace, which hides everything under it. Children are not touched. No purge job |
| `channels` | Soft | The default `general` channel (`isDefault`) cannot be deleted |
| `messages` | Soft | Responses keep the row with empty content and `deletedAt`, so threads stay readable |
| `boards` | Soft | |
| `board_columns` | Hard | Only when empty |
| `tasks` | Hard | No history feature |
| `workspace_members`, `channel_members` | Hard | Re-joining creates a new row |
| `invitations` | Never | Kept as history (see lifecycle) |
| `refresh_tokens` | Hard | Expired ones removed by the daily cleanup |
| `notifications` | Hard | After 90 days (daily cleanup) |

### Uniqueness among live rows only (partial unique indexes)
- `users(email) WHERE deleted_at IS NULL` (emails are already stored lowercase by the schema)
- `channels(workspace_id, lower(name)) WHERE deleted_at IS NULL`
- `invitations(workspace_id, email) WHERE status = 'PENDING'`

At the start of M3, check whether Prisma 7.10 can declare partial indexes in `schema.prisma`. If not, write them by hand in the migration SQL, add a comment next to the model, and review every later generated migration so it does not drop them.

**Amended (2026-11-22, M2):** checked on Prisma 7.10.1. Partial indexes are supported behind the preview feature `partialIndexes` (`previewFeatures = ["partialIndexes"]`). A partial unique index is declared in `schema.prisma`, for example `@@unique([email], where: { deletedAt: null })`, or `where: raw("…")` for a condition that is not a simple equality. `prisma migrate dev` then knows the index and does not drop it.
- Lookups on these columns use `findFirst` with the same condition (`deletedAt: null`): a partial index is not a full unique key, so `findUnique` cannot use it.
- `channels(workspace_id, lower(name))` also needs an **expression**. Whether the preview feature accepts it is checked at the start of M3; if not, that one index falls back to hand-written SQL as described above.
- Risk accepted: a preview feature may change its syntax in a later Prisma version. Prisma is pinned to `~7.10` (ADR-0011), and the generated SQL is still reviewed by hand (ADR-0036).

### Invitation lifecycle
- Status: `PENDING → ACCEPTED | REVOKED`. "Expired" is **derived** (`PENDING` and `expiresAt < now`): nothing has to run for an invitation to expire.
- The token is random (32 bytes); the database stores `sha256(token)` (same rule as Decision #5).
- Re-inviting an address that has a pending invitation **rotates** the token and `expiresAt` on the same row (no duplicate).
- `DELETE …/invitations/:id` sets `REVOKED`.

## Consequences
- The existing `users.email` unique constraint is replaced in M2 (schema-conventions migration).
- Every "find" in a repository includes `deletedAt: null` for soft-deleted entities. Integration tests cover "deleted is invisible".
