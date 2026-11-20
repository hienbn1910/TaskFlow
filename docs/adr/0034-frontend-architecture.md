# ADR-0034: Frontend architecture

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
RULE.md covered only the backend. The plan's `AuthStore (user, tokens)` suggested keeping both tokens in a store, which conflicts with Decision #5.

## Decision (rules in RULE.md §11)
1. **Folders by feature:** `src/app` (router, providers), `src/features/<feature>/` (api hooks, components, routes), `src/shared/` (ui, lib), `src/realtime/`, `src/api/generated/`.
2. **State**
   - Server data lives **only** in TanStack Query.
   - Zustand only for client state that is not in the URL: access token (memory only, never persisted), socket status, UI preferences.
   - The current workspace, channel and board come from the URL (`/w/:workspaceId/c/:channelId`, `/w/:workspaceId/b/:boardId`), so reload and shared links work.
3. **Auth flow**
   - On start, the app calls `POST /auth/refresh` once to restore the session from the cookie.
   - Interceptor: on 401, **single-flight refresh** (one refresh in flight, other requests wait for it), then retry once. If the refresh fails: clear state, go to login.
   - Logout clears the query cache.
4. **Realtime:** one module owns the socket and maps events to the query cache (`setQueryData` for created/updated/deleted, `invalidateQueries` when unsure). Components never subscribe to the socket directly.
5. **Forms:** React Hook Form + generated Zod schemas (ADR-0033).
6. **Security:** no `dangerouslySetInnerHTML`. Messages are plain text with links and mention tokens rendered by components. CSP and security headers in `vercel.json`.
7. **Quality bar per milestone:** functional, consistent, loading / empty / error states on every new screen. Visual polish and the full responsive pass happen in M7.
8. **Testing:** Vitest + Testing Library for hooks and critical components. Playwright for critical end-to-end flows (M7).

## Consequences
The frontend is built milestone by milestone with the backend (ADR-0037); these rules apply from its first commit.
