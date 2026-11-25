# Tasks — Web Foundation (Milestone 2, branch `feature/web-foundation`)

> Step 3 of the Development Flow (RULE.md §0): Task Decomposition.
> Implements [docs/plans/web-foundation.md](../plans/web-foundation.md) for [docs/specs/web-foundation.md](../specs/web-foundation.md).

**How to use this file:** one task per turn. Each task is a vertical slice: **Red** (the failing test, run and seen failing for the expected reason) → **Green** (the minimal code) → one commit. Tick the box when committed. Paths are relative to `apps/web/` unless they start with `/`.

**⚠️ = learning mode (ADR-0039, amended in M2):** the agent writes the failing test and the code, explains both, and stops for the developer's review before the next task.

**Seams:** F1–F6 of the plan §6. No test at another seam without asking.

**Done for every task:** the new test was red for the expected reason (never "module not found": stub first), is now green; `pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test` pass; functions ≤ 30 lines and ≤ 3 parameters; no `any` / `!` / unjustified `as`.

**Decision taken with the plan:** the generated types describe the controller's return type; `http.ts` removes the envelope (`unwrapEnvelope`, plan §3.1, option A).

---

## Dependency Order

```
Setup
  W0    scaffold: Vite + React + TS + ESLint + Vitest + Tailwind; smoke test; React Router 8 data mode checked
  W1    orval generation, pre* scripts, gitignore
HTTP client
  W2    unwrapEnvelope + ApiError from the error body (F5, F1)
  W3 ⚠️ request(): Bearer, 401 → refresh → retry once, no refresh without token (F1)
Session
  W4 ⚠️ refreshSession: single flight, 200 / 401 / other, Web Locks (F2, F3)
Routing
  W5 ⚠️ safeNext + RequireAuth + GuestOnly + router + not found (F5, F4)
  W6    boot: startSession, loader, home "Hello, {fullName}" (F4)
UI
  W7    layouts + tokens, errorElement, toasts on mutation errors (F4, F6)
Verification
  W8    docs, manual checks, full suite, review, PR, knowledge summary
```

W3 uses a stub `refreshSession` (records calls) so it can be tested before W4; W4 replaces the stub. W5 needs the store of W4.

---

## Setup

### - [x] W0. Scaffold

| | |
|---|---|
| Create | `package.json` (name `web`, `"type": "module"`), `index.html`, `vite.config.ts` (React plugin, Tailwind plugin, alias `@/`, proxy `/api` → `http://localhost:3000`, Vitest `jsdom` + `src/test/setup.ts`), `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`), `eslint.config.js` (spec §2), `src/main.tsx`, `src/index.css` (`@import "tailwindcss"`), `src/test/setup.ts` (jest-dom) |
| Root | `dev:web` script; `.gitignore`: `apps/web/dist/` |
| Red | `src/app/__tests__/smoke.test.tsx`: a `createMemoryRouter` + `RouterProvider` renders a route element with the text `TaskFlow`. Red: the stub route renders nothing |
| Green | The route renders `TaskFlow` |
| Check | `createBrowserRouter` / `createMemoryRouter` exist in `react-router` 8; `pnpm lint && pnpm typecheck && pnpm test` at the root run both apps |
| Done | ESLint 9 (jsx-a11y does not support 10). pnpm's `minimumReleaseAge` (1 day) refused 5 packages published hours earlier: minimums lowered so pnpm picks the newest version past the cutoff (`react-router` 8.5.2, `vitest` 5.1.1, `@types/react` 19.3.0), no `minimumReleaseAgeExclude`. `esbuild` (via orval) allowed to run its install script. Security lint rules checked with a probe file (Web Storage, `dangerouslySetInnerHTML`). `vite build`: 314 kB JS / 99 kB gzip |

### - [x] W1. Generated client

| | |
|---|---|
| Create | `orval.config.ts` (plan §3.6), `src/api/http.ts` with a minimal `request` (fetch + JSON) so the generated code compiles |
| Scripts | `generate`; `predev`, `prebuild`, `pretypecheck`, `pretest`, `prelint` run it |
| Ignore | `/.gitignore` and `/.prettierignore`: `apps/web/src/api/generated/` |
| Test | None (configuration). Proof: delete `src/api/generated/`, run `pnpm --filter web typecheck` → regenerated and green; `git status` shows no generated file; the generated `auth` file exports a refresh function, a `useGetMe` hook and its query key helper |
| Done | orval rejected `openapi.json`: it declared 3.0.0 but used the 3.1 syntax `type: [x, 'null']`. Fixed in the API (`setOpenAPIVersion('3.1.0')`) with a contract test (a type list requires 3.1); separate commit. Names: `override.operationName` maps `AuthController_me` → `authMe`, so the hooks are `useAuthMe`, `getAuthMeQueryKey`, `authRefresh` (spec names `useGetMe` read as `useAuthMe` from here on). `includeHttpResponseReturnType: false`: functions return the DTO. Proof: generated folder deleted → `pnpm --filter web typecheck` regenerated it and passed; not in `git status` |

---

## HTTP Client

### - [x] W2. `unwrapEnvelope` and `ApiError`

| | |
|---|---|
| Red (F5) | `src/api/__tests__/envelope.test.ts`: `{ success, data: x }` → `x`; `{ success, data: [a], meta }` → `{ items: [a], meta }`; `{ success, data: null }` → `null` (the three shapes of the API's `toSuccessResponse`) |
| Red (F1) | `src/api/__tests__/http.test.ts` (MSW): a 409 standard body → `ApiError { status: 409, message, requestId }`; a 400 with `details` keeps them; a non-JSON 502 → `ApiError` with a generic message and no `requestId`; a 200 response is returned unwrapped |
| Green | `unwrapEnvelope`, `ApiError`, `toApiError(response)`, `request` returns unwrapped data and throws `ApiError` |
| Also | `src/test/server.ts` (MSW `setupServer`), wired in `setup.ts`. MSW 3 renamed the option to `onUnhandledFrame: 'error'`: the old name was silently ignored (tests stayed green, unhandled requests only warned), caught by typecheck; a probe test proved an unhandled request now fails. jsdom URL = `http://localhost:5173` |
| Done | Extra cases: a 2xx body that is not the envelope throws; 204 → `undefined`; network failure → `ApiError` status 0. The error body schema is hand-written (errors are not in openapi.json) |

### - [x] W3. ⚠️ Auth retry in `request`

| | |
|---|---|
| Red (F1) | Same file: with a token in the store, the request carries `Authorization: Bearer <token>`; a 401 calls `refreshSession` once and retries once with the new token (2 calls to the endpoint); a second 401 throws `ApiError(401)`; a request sent **without** a token that gets 401 throws at once and does not call `refreshSession` |
| Green | `request`: header from the store, 401 branch, one retry. `src/features/auth/auth-store.ts` (token, status). `src/features/auth/session.ts` stub `refreshSession` (replaced in W4) |
| Done | `request` split into `send` (one fetch, Bearer) and `retryAfterRefresh` (refresh, re-read the token, one retry). Extra case: a refresh that ends the session → the original 401, no retry. `refreshSession` stubbed with `vi.mock` until W4. Mutation checks: dropping `token !== null` or the signed-out check each fails one test. Reviewed by the developer |

---

## Session

### - [ ] W4. ⚠️ `refreshSession`

| | |
|---|---|
| Red (F2) | `src/features/auth/__tests__/session.test.ts` (MSW): five `request` calls that get 401 together → exactly **one** `POST /auth/refresh`, then five retries; refresh 200 → store `authenticated` with the token, and the User is in the cache under the `/auth/me` query key; refresh 401 → store `anonymous`, token `null`, cache empty; network error during `startSession()` → `anonymous`, one refresh call only |
| Red (F3) | `withRefreshLock`: with a fake `navigator.locks.request` it runs the callback inside the lock named `taskflow-refresh`; without `navigator.locks` it runs the callback directly |
| Green | `refreshSession`, `startSession`, `withRefreshLock`; `rawRequest` in `http.ts` (no Bearer, no retry, plan §3.2); `src/app/query-client.ts` |

---

## Routing

### - [ ] W5. ⚠️ Guards, `safeNext`, router

| | |
|---|---|
| Red (F5) | `src/shared/lib/__tests__/safe-next.test.ts`: `/w/1?x=2` kept; `//evil.example`, `/\evil.example`, `https://evil.example`, `javascript:alert(1)`, `''`, `null` → `/` |
| Red (F4) | `src/app/__tests__/routing.test.tsx` (memory router, store set directly): `unknown` → loader on `/` and `/login`; `anonymous` on `/` → redirected to `/login?next=%2F`; `authenticated` on `/login?next=%2Fsettings` → `/settings`; `authenticated` on `/login?next=%2F%2Fevil.example` → `/`; unknown path → not-found page |
| Green | `safeNext`, `RequireAuth`, `GuestOnly`, `routes` (shared by `createBrowserRouter` and tests), `FullPageLoader`, `NotFoundPage`, placeholder `LoginPage`, `RegisterPage`, `HomePage` |

### - [ ] W6. Boot and home

| | |
|---|---|
| Red (F4) | `src/app/__tests__/boot.test.tsx` (MSW, the real `startSession` + router): refresh 200 → loader first, then `Hello, Hien Bui` with no `GET /auth/me` request; refresh 401 → login page at `/login?next=%2F` |
| Green | `startSession()` called from `main.tsx` before render; `HomePage` reads `useGetMe()` |

---

## UI

### - [ ] W7. Layouts, tokens, errors, toasts

| | |
|---|---|
| Red (F4) | `routing.test.tsx`: a route element that throws → error page with a reload button |
| Red (F6) | `src/app/__tests__/mutation-toast.test.tsx`: a mutation failing with `ApiError(409, …, requestId)` → toast containing the message and `Error ID: <requestId>`; with `meta: { toast: false }` → no toast; `ApiError(401)` → no toast |
| Green | `MutationCache.onError` in `query-client.ts`, `<Toaster />`; `RouteError`; `AppShell` (top bar with `fullName`), `PublicLayout` (centred card); `@theme` tokens (spec §3); `ErrorState` |

---

## Verification

### - [ ] W8. Docs, manual checks, review, PR

| | |
|---|---|
| Docs | ADR-0034 point 3 (single flight + Web Locks), ADR-0033 (orval confirmed, envelope note), ADR-0011 (web versions); RULE.md §11 if the tree changed; CLAUDE.md checkbox |
| Manual | API + `pnpm dev:web`; login through Swagger; on `localhost:5173`: loader then name; reload stays logged in; two tabs opened together stay logged in, API log has no "reuse detected"; no token in Web Storage; without cookie `/` → `/login?next=%2F`; `vite build` size noted |
| Finish | Full suite at the root; `review-against-spec`; refactor; PR text (`pr` skill); knowledge summary in `notes/` |
