# ADR-0025: Real-time design — auth lifecycle, rooms, event names, delivery and resync

- **Status:** Accepted (supersedes ADR-0008)
- **Date:** 2026-11-21

## Context
The earlier plan had one room per workspace and "broadcast to room". That plan would have:
- sent **private** channel messages to every workspace member;
- kept sockets alive after the access token expired or the account was blocked (the JWT is only checked at handshake);
- trusted `userId` sent by the client in `typing`;
- lost every event sent while a client was offline, with no way to recover.

## Decision

### Authentication lifecycle
- The client sends the access token in the handshake `auth` field (never the query string: proxies log URLs).
- The gateway applies the same checks as `JwtAuthGuard`: HS256, Zod payload, reload user, `canSignIn`. It stores `{ userId, tokenExp }` in `socket.data`.
- At `tokenExp` the server disconnects the socket with reason `auth_expired`. The client refreshes through REST and reconnects (Socket.io `auth` callback reads the fresh token).
- On logout-all, password change, block or delete: `in('user:{id}').disconnectSockets()`.

### Rooms and authorization
| Room | Joined | Carries |
|---|---|---|
| `user:{userId}` | Automatically on connect | Notifications, own membership changes, forced logout |
| `workspace:{workspaceId}` | Client emits `workspace:join` when a workspace is opened. Server checks membership. One workspace at a time per socket | Members joined/left/role changed, **public** channel created/updated/deleted, presence |
| `channel:{channelId}` | Server adds the socket for every channel the user is a member of, on `workspace:join`, and when the user joins a channel | Messages, edits, deletes, typing |
| `board:{boardId}` | Client emits `board:join` / `board:leave` when a board is opened/closed. Server checks membership | Task and column events |

- Private channel data **never** goes to the workspace room.
- When a member leaves or is removed (workspace or channel), the server calls `in('user:{id}').socketsLeave(...)` and emits `workspace:removed` / `channel:removed` to their user room.

### Event names and payloads
- Server → client: `resource:past-tense-verb`.
  `message:created|updated|deleted`, `typing:started|stopped`, `channel:created|updated|deleted|removed`, `member:joined|left|role-changed`, `presence:online|offline`, `task:created|updated|moved|deleted`, `column:created|updated|deleted`, `columns:reordered`, `notification:created`, `workspace:removed`.
- Client → server (imperative): `workspace:join`, `board:join`, `board:leave`, `typing:start`, `typing:stop`.
- **Sending a message goes through REST only**, so validation, idempotency and rate limiting live in one place. Sockets carry server pushes and ephemeral signals.
- Envelope: `{ workspaceId, occurredAt, data }`. `data` is the **same response DTO as REST**, parsed with the same Zod schema before emitting (Decision #13, ADR-0033).

### Delivery and resync
- Delivery is **best effort, at most once**. REST is the source of truth.
- The client deduplicates by id and ignores an update older than its cached `updatedAt`.
- On reconnect: re-join rooms; fetch the open channel with `?after=<newest cursor>` (ADR-0024); invalidate channel list and unread counts, the open board, and the notification count.

### Acknowledgements and errors
- Client → server events use an ack: `{ success: true }` or `{ success: false, statusCode, error, message }` (Decision #1 shape).
- Unexpected errors are emitted as `exception` with the same shape. No stack traces.

### Typing and presence
- `userId` always comes from `socket.data`, never from the payload.
- `typing:start` at most once per 2 s per user per channel. The server emits `typing:stopped` after 5 s without a new start (in-process timer, ADR-0018).
- Presence: in-process connection counter per user behind `PresenceStore`. Online on 0 → 1 connection; offline on 1 → 0 after a 10 s grace period (a page reload does not flicker). `GET …/members` includes an `online` flag.

### Limits
20 client events per 10 s per socket; above that the ack returns 429; repeated abuse disconnects.

## Consequences
- Integration tests with `socket.io-client` against the real app (RULE.md §7): cannot join another tenant's workspace or board; a non-member receives no private channel event; a removed member stops receiving events; an expired token is disconnected.
- The frontend needs a single realtime module that maps events to TanStack Query cache updates (ADR-0034).
