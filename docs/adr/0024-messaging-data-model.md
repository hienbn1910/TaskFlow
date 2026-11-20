# ADR-0024: Messaging data — cursor, threads, unread counts, limits, idempotency, raw SQL policy

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- The plan used `cursor=<lastMessageId>`, but ids are UUID v4: random, not ordered. They cannot serve as a position.
- Thread reply counts and unread counts per channel become N+1 queries when the sidebar loads 20 channels.
- `messages.content` had no maximum length (storage is the first limit to break, WORKFLOW.md §3).
- A client retrying after a network error would create the message twice.

## Decision

### Pagination
- Order: `(createdAt DESC, id DESC)`. The cursor is an **opaque** base64url string of `{ createdAt, id }`.
- Condition: `createdAt < c.createdAt OR (createdAt = c.createdAt AND id < c.id)` (expressible with Prisma).
- `GET …/messages?before=<cursor>&limit=30` for scrolling up. `?after=<cursor>` (ascending) for resync after a reconnect (ADR-0025). `limit` ≤ 50.
- Index: `messages(channelId, parentId, createdAt, id)`.

### Threads
- One level only: a reply cannot have replies.
- The parent stores `replyCount` and `lastReplyAt`, updated in the **same transaction** as the reply insert.
- The channel list shows `parentId IS NULL`. A thread is loaded with `GET …/messages/:id/thread` (same cursor rules).

### Unread counts
- `channel_members.lastReadAt`. `POST …/channels/:id/read` sets it.
- The sidebar gets all unread counts of a workspace in **one** query (grouped by channel), each capped at 100 (shown "99+").

### Limits and format
- Content: 1–4,000 characters after trim. ≤ 5 attachments per message.
- `editedAt` (timestamp) instead of an `isEdited` boolean.
- Mentions are stored as tokens `<@userId>` inside the content. The server accepts only ids of channel members. The frontend renders them as names.

### Idempotent send
- The client generates `clientMessageId` (UUID) per message. Unique: `(channelId, senderId, clientMessageId)`.
- A duplicate returns the existing message (200) instead of creating a second one. The same id lets the frontend reconcile its optimistic message.

### Raw SQL policy (applies to the whole API)
Allowed only when the Prisma API cannot express the query (e.g. grouped unread counts with a join condition), and then:
- only inside a repository;
- only with tagged templates (`$queryRaw\`…${param}\``, `Prisma.sql`); `$queryRawUnsafe` is forbidden;
- the query includes `workspaceId`;
- covered by an integration test.

## Alternatives considered
| Option | Rejected because |
|---|---|
| UUID v7 (time-ordered ids) as the cursor | Works, but two id strategies in one schema; the composite cursor works with the existing ids |
| Offset pagination | Pages shift when messages arrive |
| Counting replies / unread with `COUNT` per row | N+1 queries on every sidebar load |

## Consequences
Counters must be maintained in transactions; a test checks `replyCount` after create and delete.
