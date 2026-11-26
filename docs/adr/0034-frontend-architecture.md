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
3. **Auth flow** (amended in M2, `feature/web-foundation`)
   - On start, the app calls `POST /auth/refresh` once to restore the session from the cookie: at module level in `main.tsx`, never in an effect (React StrictMode runs effects twice).
   - Interceptor: on 401, for a request that was sent with an access token, refresh then retry once. A 401 on a request sent without a token (wrong password) never triggers a refresh.
   - **One refresh at a time, in the tab and across tabs.** The API has no grace window: sending a rotated refresh token again revokes every session (ADR-0005). So `refreshSession()` is single flight in the tab (every caller shares the promise in flight) and runs inside a Web Lock (`navigator.locks.request('taskflow-refresh', …)`) across tabs: a second tab waits, then refreshes with the cookie the first one already rotated. Where Web Locks do not exist, only the in-tab guard applies.
   - The refresh itself goes through a raw request (no Bearer, no retry), so a failed refresh cannot start another.
   - Refresh result: 200 → token in the store, User in the query cache under the `GET /auth/me` key; 401 / 403 → session over, store cleared, `queryClient.clear()`; any other failure (network, 429, 5xx) does not end the session.
   - The store holds only `accessToken` and `status` (`unknown` / `authenticated` / `anonymous`); the User lives in the query cache.
   - Logout clears the query cache.

   Rejected: a grace window in the API (the previous refresh token stays valid for a few seconds). It would loosen ADR-0005: a stolen token gets a window of use, and reuse detection gets fuzzier.
4. **Realtime:** one module owns the socket and maps events to the query cache (`setQueryData` for created/updated/deleted, `invalidateQueries` when unsure). Components never subscribe to the socket directly.
5. **Forms:** React Hook Form + generated Zod schemas (ADR-0033).
6. **Security:** no `dangerouslySetInnerHTML`. Messages are plain text with links and mention tokens rendered by components. CSP and security headers in `vercel.json`.
7. **Quality bar per milestone:** functional, consistent, loading / empty / error states on every new screen. Visual polish and the full responsive pass happen in M7.
8. **Testing:** Vitest + Testing Library for hooks and critical components. Playwright for critical end-to-end flows (M7).

## Consequences
The frontend is built milestone by milestone with the backend (ADR-0037); these rules apply from its first commit.
