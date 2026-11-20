# ADR-0022: Soft-delete policy, partial unique indexes, invitation lifecycle

- **Status:** Accepted (extends Decision #4)
- **Date:** 2026-11-21

## Context
- A soft-deleted row keeps its unique values. Today a user who deleted their account can never register again with the same email. The same would hold for workspace slugs and channel names.
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
- `workspaces(slug) WHERE deleted_at IS NULL`
- `channels(workspace_id, lower(name)) WHERE deleted_at IS NULL`
- `invitations(workspace_id, email) WHERE status = 'PENDING'`

At the start of M3, check whether Prisma 7.10 can declare partial indexes in `schema.prisma`. If not, write them by hand in the migration SQL, add a comment next to the model, and review every later generated migration so it does not drop them.

### Invitation lifecycle
- Status: `PENDING → ACCEPTED | REVOKED`. "Expired" is **derived** (`PENDING` and `expiresAt < now`): nothing has to run for an invitation to expire.
- The token is random (32 bytes); the database stores `sha256(token)` (same rule as Decision #5).
- Re-inviting an address that has a pending invitation **rotates** the token and `expiresAt` on the same row (no duplicate).
- `DELETE …/invitations/:id` sets `REVOKED`.

## Consequences
- The existing `users.email` unique constraint is replaced in M2 (schema-conventions migration).
- Every "find" in a repository includes `deletedAt: null` for soft-deleted entities. Integration tests cover "deleted is invisible".
