# Plan — Web Foundation (Milestone 2, branch `feature/web-foundation`)

> Step 2 of the Development Flow (RULE.md §0). Implements [docs/specs/web-foundation.md](../specs/web-foundation.md).
> Versions looked up on 2026-11-25 (`pnpm view`); recorded in ADR-0011 at the end of the branch.

---

## 1. Dependencies to Add (`apps/web`)

| Package | Version | Kind | Why |
|---|---|---|---|
| `react`, `react-dom` | ^19.3 | dependency | UI |
| `react-router` | ^8.5 | dependency | Routing, data mode (spec §6). Major 8 since ADR-0034 was written: `createBrowserRouter` checked in W0 |
| `@tanstack/react-query` | ^5.108 | dependency | Server state (ADR-0034) |
| `zustand` | ^5.1 | dependency | Auth store (token, status) |
| `zod` | ^4.1 | dependency | Generated schemas; same major as the API |
| `sonner` | ^2.0 | dependency | Toasts (spec §7) |
| `vite`, `@vitejs/plugin-react` | ^8.3, ^6.3 | dev | Build, dev server, proxy |
| `tailwindcss`, `@tailwindcss/vite` | ^4.3 | dev | Styling (spec §3) |
| `typescript` | ~5.9.3 | dev | Same as the API (ADR-0011) |
| `orval` | ^8.49 | dev | Client, hooks and Zod schemas from `openapi.json` (ADR-0033) |
| `vitest`, `jsdom` | ^5.1, ^31 | dev | Test runner, DOM |
| `@testing-library/react`, `user-event`, `jest-dom` | ^16.3, ^14.6, ^8.0 | dev | Component tests |
| `msw` | ^3.0 | dev | Network mock: the only mocked boundary (ADR-0039) |
| `eslint` | ^9.39 | dev | **9, not 10:** `eslint-plugin-jsx-a11y` 6.10 supports ESLint ≤ 9. Same major as the API |
| `typescript-eslint`, `globals` | ^8.74, ^17 | dev | TypeScript rules |
| `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y` | ^7.1, ^0.5, ^6.10 | dev | React rules (spec §2) |
| `@types/react`, `@types/react-dom` | ^19.3 | dev | Types |

Root `package.json`: `dev` stays the API only; a new `dev:web` (`pnpm --filter web dev`). `lint`, `typecheck`, `test` already run `pnpm -r`.

## 2. Data Flow

### 2.1 Boot

```text
main.tsx (module level, before render)
  startSession()                              never in a useEffect (StrictMode runs effects twice)
    refreshSession()                          status = 'unknown' until it settles
  render <QueryClientProvider><RouterProvider/><Toaster/></…>
    protected / guest-only layout
      status 'unknown'        → <FullPageLoader/>
      status 'authenticated'  → page;  <HomePage> useGetMe() → cache hit, no request
      status 'anonymous'      → <Navigate to="/login?next=…"/>
```

### 2.2 A request

```text
generated hook (orval) → http.ts request(config)
  fetch(relative URL, credentials 'same-origin', Bearer token if any)
  2xx → unwrapEnvelope(body)                 { success, data } → data
                                             { success, data, meta } → { items: data, meta }
  401 and a token was sent → refreshSession() → retry once with the new token
  other error → throw ApiError { status, message, details, requestId }
```

### 2.3 `refreshSession()`

```text
refreshSession()
  inFlight ??= withRefreshLock(async () => {        navigator.locks.request('taskflow-refresh')
      res = fetch POST /api/v1/auth/refresh           raw request: no Bearer, no 401 retry
      200     → store.signIn(token); queryClient.setQueryData(/auth/me key, user)
      401/403 → store.signOut(); queryClient.clear()
      other   → boot: status 'anonymous' (cookie kept) · retry path: rethrow
  }).finally(() => inFlight = null)
  return inFlight
```

## 3. Design Choices Inside the Spec

### 3.1 The response envelope ⚠️ (decision for the developer)
`openapi.json` describes the **controller's return type** (`AuthResponseDto`, `UserResponseDto`), but the wire carries the envelope added by `ResponseInterceptor`: `{ success: true, data }`, or `{ success: true, data: items, meta }` for a paginated result.

- **Chosen:** `http.ts` applies the exact inverse of `toSuccessResponse` (`unwrapEnvelope`): `data` for a single item, `{ items: data, meta }` when `meta` is present. The generated types then match what callers receive, and hooks read `data.fullName`, not `data.data.fullName`.
- **Rejected:** wrapping every 2xx schema of the OpenAPI document in the envelope (an API change). The contract would be literal, but every generated type gains a `data` level and `meta` would need a second response type per list.
- **Guard:** a unit test feeds `toSuccessResponse`-shaped bodies (single, paginated, `null`) to `unwrapEnvelope`. Swagger UI keeps showing the unwrapped shape; this is noted in ADR-0033.

### 3.2 Refresh outside the generated client
`refreshSession()` calls `fetch` itself (through a small `rawRequest` in `http.ts`), not the generated `postAuthRefresh`. The generated function goes through the interceptor, so a 401 on refresh would call refresh again. The response is still typed with the generated `AuthResponseDto` type.

### 3.3 One query client, one store, resettable in tests
`queryClient` (`src/app/query-client.ts`) and the Zustand store are module singletons, because `refreshSession()` must reach them from outside React. Tests reset both in `beforeEach` (`queryClient.clear()`, `store.setState(initial)`), and the in-flight promise is always cleared in `finally`.

### 3.4 Web Locks
`withRefreshLock(fn)`: `navigator.locks?.request('taskflow-refresh', fn) ?? fn()`. jsdom has no `navigator.locks`, so tests cover the fallback directly and the lock path with a fake `navigator.locks` that records the lock name and runs the callback (a test double of a browser API, a system boundary).

### 3.5 `next` validation
Pure function `safeNext(value: string | null): string`: returns `value` only when it starts with `/` and the second character is neither `/` nor `\`, and it has no control character; else `/`. Unit tested with `//evil.example`, `/\evil.example`, `/\t/evil.example`, `https://evil.example`, `javascript:…`, `''`, `null`.

### 3.6 orval configuration
`orval.config.ts`, two outputs from `../api/openapi.json`:
1. `react-query` client, `mode: 'tags-split'` (one file per tag: `auth`, `users`, `health`), `override.mutator` → `src/api/http.ts` `request`;
2. `zod` client, `mode: 'tags-split'`, file suffix `.zod.ts`.
Both into `src/api/generated/` (gitignored). The exact option names are checked against orval 8 in W1.

### 3.7 ESLint and generated code
`src/api/generated/**` is ignored by ESLint and excluded from `max-lines-per-function`. It is still type-checked (it is imported).

## 4. Files

### 4.1 New

| File | Responsibility |
|---|---|
| `apps/web/package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `orval.config.ts`, `index.html` | Project setup |
| `src/main.tsx` | `startSession()`, then render |
| `src/index.css` | Tailwind import + `@theme` tokens |
| `src/app/query-client.ts` | `queryClient` + `MutationCache.onError` toast |
| `src/app/router.tsx` | Route table (spec §6) |
| `src/app/layouts/AppShell.tsx`, `PublicLayout.tsx` | Layouts (spec §3) |
| `src/app/guards/RequireAuth.tsx`, `GuestOnly.tsx` | Session-aware layout routes |
| `src/app/RouteError.tsx` | `errorElement` page |
| `src/api/http.ts` | `request` (orval mutator), `rawRequest`, `ApiError`, `unwrapEnvelope` |
| `src/features/auth/session.ts` | `refreshSession`, `startSession`, `withRefreshLock` |
| `src/features/auth/auth-store.ts` | Zustand: `accessToken`, `status`, `signIn`, `signOut` |
| `src/features/auth/routes/SignInPage.tsx`, `SignUpPage.tsx` | Placeholders (`/login`, `/register`; GLOSSARY: avoid "Login") |
| `src/features/home/routes/HomePage.tsx` | "Hello, {fullName}" |
| `src/shared/ui/FullPageLoader.tsx`, `NotFoundPage.tsx`, `ErrorState.tsx` | Shared UI |
| `src/shared/lib/safe-next.ts` | `next` validation |
| `src/test/setup.ts`, `src/test/server.ts`, `src/test/render.tsx` | jest-dom, MSW server, render with providers |

### 4.2 Modified

| File | Change |
|---|---|
| `package.json` (root) | `dev:web` script |
| `.gitignore` | `apps/web/src/api/generated/`, `apps/web/dist/` |
| `.prettierignore` | `apps/web/src/api/generated/` |
| `docs/adr/0033`, `0034`, `0011` | Spec §10 |
| `RULE.md` §11 | Only if the tree changes (`src/test/`) |
| `CLAUDE.md` | Branch checkbox |

## 5. Order of Work (detail in `docs/tasks/`)

1. W0 Scaffold: Vite + React + TS + ESLint + Vitest + Tailwind, smoke test; React Router 8 data mode confirmed.
2. W1 orval generation, `pre*` scripts, gitignore.
3. W2 `http.ts` pure parts: `unwrapEnvelope`, `ApiError` from the error body.
4. W3 ⚠️ `http.ts` request: Bearer, 401 → refresh → retry once, no refresh without a token.
5. W4 ⚠️ `refreshSession`: single flight (5 × 401 → 1 refresh), results 200 / 401 / other, Web Locks wrapper.
6. W5 `safeNext` + guards + router + not found.
7. W6 Boot: `startSession`, loader, home with the User's name.
8. W7 Layouts and tokens; `errorElement`; toasts via `MutationCache`.
9. W8 Docs (ADRs), manual checks (two tabs, reload), review, PR, knowledge summary.

## 6. Seams Under Test

| # | Seam | Kind | Catches | Misses |
|---|---|---|---|---|
| F1 | `http.ts` `request` against MSW | Integration (network mocked) | Bearer header; envelope unwrapped; `ApiError` with `requestId` and `details`; 401 → one refresh → one retry; second 401 → error; no refresh when no token was sent | Real cookie and proxy behaviour (manual check, deploy branch) |
| F2 | `refreshSession` against MSW | Integration | 5 concurrent 401 → exactly 1 `POST /auth/refresh`; 200 → token in store and User in cache under the `/auth/me` key; 401 → `anonymous` + cache cleared; network error during boot → `anonymous`, no retry loop | Real cross-tab behaviour (manual: two tabs) |
| F3 | `withRefreshLock` | Unit (browser API faked) | Runs inside `taskflow-refresh`; runs directly without `navigator.locks` | That Safari and Chrome honour the lock (manual) |
| F4 | Rendered app (router + providers + MSW) | Component | Loader first, then "Hello, {fullName}"; refresh 401 → `/login?next=%2F`; authenticated User on `/login?next=…` → safe target; unknown path → not found; thrown render error → error page | Visual layout |
| F5 | Pure logic | Unit | `unwrapEnvelope` (single, paginated, `null`), `safeNext` (open-redirect cases) | Wiring (F1, F4) |
| F6 | Mutation toast | Component | Failed mutation → toast with `requestId`; `meta: { toast: false }` → none; no toast on 401 | Toast styling |

**Not tested automatically, verified by hand (PR "Evidence"):** login through Swagger on `localhost:3000`, then on `localhost:5173`: reload stays logged in; two tabs opened together stay logged in and the API log has no "reuse detected"; DevTools shows no token in Web Storage.

**⚠️ parts** (agent writes test and code, explains, stops for review, ADR-0039): W3, W4, W5 (guards and `safeNext`).

## 7. Security and Performance Notes

- **Security:** token only in memory; refresh never doubled (session-revocation safety); no open redirect; no `dangerouslySetInnerHTML`; relative URLs only (no API host baked into the bundle); `queryClient.clear()` on sign-out so the next person on the same browser sees nothing.
- **Performance:** one request on boot (refresh), the User comes with it (no `/auth/me` call); no web font; `sonner` and Zustand are small. Bundle size is checked once in W8 (`vite build` output) and noted in the PR.
