# Spec — Web Foundation (Milestone 2, branch `feature/web-foundation`)

> Step 1 of the Development Flow (RULE.md §0). Decisions settled with the developer in a grilling session (2026-11-25, Q1–Q15).
> Sources: WORKFLOW.md §3, §3 flow 4 "Session in the browser", §7 Milestone 2 tasks 2.10–2.16;
> ADR-0005, 0011, 0020, 0033, 0034, 0035, 0038, 0039; RULE.md §2, §11; GLOSSARY.md.
> Builds on [api-production-readiness.md](api-production-readiness.md) (cookie `SameSite=Lax`, Origin check, `openapi.json`).

---

## 1. Scope

The first frontend code: an empty but production-shaped web app. It restores the session from the refresh cookie, keeps the access token in memory, refreshes it on 401, and shows the current User on a protected home page. The auth forms come in `feature/web-auth`.

### In scope

| # | Item | Source |
|---|---|---|
| 2.10 | Vite + React + TypeScript strict, ESLint, Vitest; folder structure of RULE.md §11 | ADR-0034 |
| 2.11 | Tailwind + base tokens; app shell and public layout | ADR-0034 |
| 2.12 | React Router: public, guest-only and protected routes; not-found page | ADR-0034 |
| 2.13 | Generated client, TanStack Query hooks and Zod schemas from `openapi.json` (`orval`) | ADR-0033 |
| 2.14 | HTTP client: credentials, single-flight refresh on 401, retry once | ADR-0034 |
| 2.15 | Auth store: access token in memory only; session restore on boot | ADR-0005, 0034 |
| 2.16 | Vite proxy `/api` → `localhost:3000`; error boundary; toasts | ADR-0020 |

### Out of scope

| Item | Planned for |
|---|---|
| Login, register, profile, change password and logout UI; form error mapping | `feature/web-auth` |
| `vercel.json` (rewrites, security headers, CSP), Sentry for the web | `chore/deploy-pipeline` |
| Workspace sidebar, realtime module | M3, M4 |
| Dark mode, visual polish, full responsive pass, Playwright | M7 |
| i18n | Not planned |

### API used (unchanged)

| Method | Path | Use |
|---|---|---|
| POST | `/api/v1/auth/refresh` | Session restore and refresh; returns `{ accessToken, user }` and rotates the cookie |
| GET | `/api/v1/auth/me` | Its query key holds the current User (filled from the refresh response) |

**Constraint found during grilling:** the API has no grace window. Replaying a refresh token that was already rotated is treated as theft and **revokes every session of the User** (ADR-0005). The browser must therefore never send two refresh requests with the same cookie (§5).

---

## 2. Project Setup (2.10)

- `apps/web`: Vite + React 19 + TypeScript 5.9 (same major as the API, ADR-0011), ESM.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`; path alias `@/` → `src/`.
- ESLint (flat config, own file in `apps/web`):
  - the API's rules: no `any`, no non-null assertion, functions ≤ 30 lines, ≤ 3 parameters, `no-floating-promises`, no `.then()/.catch()`;
  - plus `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y` (recommended);
  - test files get the same relaxations as in the API; `src/api/generated/` is ignored.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `generate`. The root scripts (`pnpm -r …`) run them with the API's.
- Folder structure: RULE.md §11. Only the folders this branch needs are created.
- Versions: latest stable at install time; recorded in ADR-0011.

## 3. Styling and Layouts (2.11)

- Tailwind v4, tokens in `src/index.css` (`@theme`):
  - colours: `brand-50…900`, neutrals, `danger`, `success`;
  - system font stack, no web font;
  - named radii for cards and inputs; Tailwind's default spacing scale.
- Light theme only.
- **Public layout:** one card centred on the page (login, register, later invitations).
- **App shell (protected layout):** top bar with the app name and the User's `fullName`, an empty slot for the menu (logout comes in `feature/web-auth`), and the main area. No sidebar yet.
- Every screen has loading, empty and error states (RULE.md §11).
- UI text in English, using GLOSSARY.md terms ("User", never "Account").

## 4. Generated API Client (2.13)

- `orval` reads `../api/openapi.json` and produces, in `src/api/generated/` (gitignored, ADR-0033):
  1. typed request functions and TanStack Query hooks (`react-query` client), all calling the custom mutator `src/api/http.ts`;
  2. Zod schemas (`zod` client), for forms in `feature/web-auth`.
- `generate` runs before `dev`, `build`, `typecheck`, `test` and `lint` (`pre*` scripts), so a fresh clone works with any root command.
- No hand-written request or response types (RULE.md §11).

## 5. HTTP Client and Session (2.14, 2.15) ⚠️

### 5.1 `http.ts`

- `fetch`, no `axios`. Every request:
  - goes to a relative URL (`/api/v1/…`), so the Vite proxy (dev) or Vercel rewrite (prod) keeps it same-origin;
  - is sent with `credentials: 'same-origin'`;
  - carries `Authorization: Bearer <token>` when the store has an access token.
- Errors become `ApiError { status, message, details?, requestId? }`, read from the standard error body (ADR-0001, 0035). A body that is not the standard shape (proxy error, network failure) gives a generic message.
- **On 401, for a request that was sent with an access token:** call `refreshSession()`, then retry the request **once** with the new token. A second 401 is returned as an error.
- **Assumption:** a 401 on a request sent *without* a token (login with wrong credentials, the refresh call itself) is returned as is: it never triggers a refresh.

### 5.2 `refreshSession()`: one refresh at a time

The only function that calls `POST /auth/refresh`. Used on boot and by the 401 interceptor; never called from a component effect (React StrictMode runs effects twice in development).

1. **In the tab (single flight):** while a refresh is in flight, every caller gets the same promise. Five requests that fail with 401 together cause exactly one refresh.
2. **Across tabs:** the call runs inside `navigator.locks.request('taskflow-refresh', …)` (Web Locks API). A second tab waits until the first is done, then refreshes with the already rotated cookie.
   - **Assumption:** where `navigator.locks` does not exist, only the in-tab guard applies.
   - Rejected alternative: a grace window in the API, which would loosen ADR-0005 (a stolen token gets a window of use).
3. **Result:**
   - `200`: store the access token, set `status = 'authenticated'`, put `user` in the query cache under the key of `GET /auth/me`.
   - `401` or `403`: the session is gone. Clear the token, set `status = 'anonymous'`, `queryClient.clear()`.
   - **Assumption:** any other failure (network, 429, 5xx) does not end the session. During boot it sets `status = 'anonymous'` (the cookie is kept, a reload can restore it). During a retry, the original request fails with that error.

### 5.3 Auth store (Zustand)

- State: `accessToken: string | null`, `status: 'unknown' | 'authenticated' | 'anonymous'`. Memory only: never `localStorage` or `sessionStorage` (ADR-0005).
- `status` starts as `'unknown'`; the boot refresh settles it.
- `user` is **not** in the store: components read it with the generated `useGetMe()` hook, served from the cache filled by §5.2 (ADR-0034).

## 6. Routing (2.12)

`createBrowserRouter` (data mode). No `loader` fetches data: server data stays in TanStack Query.

| Path | Kind | Page |
|---|---|---|
| `/` | protected | Home placeholder: "Hello, {fullName}" from `useGetMe()` |
| `/login` | guest only | Placeholder (form in `feature/web-auth`) |
| `/register` | guest only | Placeholder (form in `feature/web-auth`) |
| `*` | public | Not found |

- **Protected routes:** `unknown` → full-page loading screen; `anonymous` → redirect to `/login?next=<current path and query>`.
- **Guest-only routes:** `unknown` → loading screen; `authenticated` → redirect to `next` when valid, else `/`.
- **`next` validation:** accepted only when it starts with `/` and not with `//` or `/\`. Anything else falls back to `/` (no open redirect).
- The not-found page renders immediately, whatever the session status.

## 7. Errors and Notifications (2.16)

- **Toasts:** `sonner`.
- **Mutations:** a global `MutationCache.onError` shows a toast with the error `message` and `Error ID: <requestId>` when present. A mutation opts out with `meta: { toast: false }`. A 401 never shows a toast.
- **Queries:** errors are shown in place on the screen, with a retry button. No toast.
- **Render errors:** the router's `errorElement` shows an error page with a reload button.

## 8. Development Proxy (2.16)

- Vite `server.proxy`: `/api` → `http://localhost:3000`. The browser sees one origin (`http://localhost:5173`), so the refresh cookie (`Path=/api/v1/auth`, `SameSite=Lax`) is sent and the API's Origin check (`FRONTEND_URL`) passes (ADR-0020).
- No `VITE_API_URL`: every URL is relative.

## 9. Tests (ADR-0039)

- Vitest + Testing Library + MSW, `jsdom` environment.
- Only the network is mocked (MSW handlers play the API). `http.ts`, the store, the generated hooks and the components run for real.

| Seam | Catches |
|---|---|
| `http.ts` + `refreshSession()` (MSW) | Bearer header; 401 → one refresh → retry once; 5 concurrent 401 → exactly 1 refresh; refresh 401 → `anonymous` and cache cleared; no refresh for a request without token; `ApiError` from the standard body |
| Web Locks wrapper | The refresh runs inside the named lock; works without `navigator.locks` |
| Session boot (rendered app) | Loading screen first, then home with "Hello, {fullName}" (refresh 200) or redirect to `/login?next=/` (refresh 401) |
| Routing | Guest-only page redirects an authenticated User; invalid `next` falls back to `/`; unknown path shows not found |
| Errors | Failed mutation shows a toast with the `requestId`; `meta: { toast: false }` shows none; `errorElement` renders on a thrown render error |

## 10. Documentation

- ADR-0034 point 3 amended: in-tab single flight + Web Locks across tabs, the reason (no grace window, ADR-0005) and the rejected alternative.
- ADR-0033: tool confirmed, `orval` with two outputs (hooks, Zod).
- ADR-0011: web package versions.
- RULE.md §11 tree: unchanged unless the build adds a folder.
- CLAUDE.md: tick the branch checkbox.

## 11. Acceptance Criteria

**Setup**
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass at the root, for `api` and `web`, on a fresh clone (generation runs first).
- [ ] `src/api/generated/` is not committed.

**Session**
- [ ] With a valid refresh cookie, opening `http://localhost:5173` shows the loading screen, then "Hello, {fullName}", without a flash of the login page.
- [ ] Reloading the page keeps the User logged in.
- [ ] Two tabs opened at the same time both end up logged in, and the User's sessions are not revoked (API log has no "reuse detected").
- [ ] Without a cookie, `/` redirects to `/login?next=%2F`.
- [ ] The access token is never in `localStorage`, `sessionStorage` or a non-HttpOnly cookie.

**HTTP client**
- [ ] Five requests that get 401 together cause exactly one `POST /auth/refresh`, then each is retried once.
- [ ] When the refresh returns 401, the store is `anonymous` and the query cache is empty.

**Routing and errors**
- [ ] `/login?next=https://evil.example` sends an authenticated User to `/`, not to the other site.
- [ ] An unknown path shows the not-found page.
- [ ] A failed mutation shows a toast containing the `requestId`.
