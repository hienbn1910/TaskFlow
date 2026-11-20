# ADR-0020: Same-origin API through a proxy; refresh cookie `SameSite=Lax`; Origin check

- **Status:** Accepted (amends Decision #5)
- **Date:** 2026-11-21

## Context
- The web app (`*.vercel.app`) and the API (`*.onrender.com`) are **different sites**: both domains are on the Public Suffix List. A cookie set by the API is a **third-party cookie** for the web app.
- Today's code sets `SameSite=None; Secure` in production. That is correct for cross-site, but Safari (ITP) and any browser blocking third-party cookies drop it: the user is silently logged out after 15 minutes.
- `SameSite=None` also means any website can send a POST to `/auth/logout` or `/auth/refresh` with the cookie attached (CSRF). It cannot read the response, but it can force a logout.

## Decision
1. **Production:** `apps/web/vercel.json` rewrites `/api/:path*` to `https://<render-host>/api/:path*`. The browser talks to one origin.
   **Development:** Vite's `server.proxy` does the same for `localhost:5173` → `localhost:3000`.
2. **Refresh cookie:** `HttpOnly; Secure` (production); `SameSite=Lax`; `Path=/api/v1/auth`; no `Domain` attribute.
3. **Origin check** on every route that reads the cookie (`/auth/refresh`, `/auth/logout`): `Origin` must equal `FRONTEND_URL`, otherwise 403. Defence in depth on top of `SameSite=Lax`.
4. **WebSocket connects directly to the Render URL**, not through Vercel. It authenticates with the access token in the handshake `auth` field (ADR-0025), so no cookie is involved. Socket.io CORS allowlist = `FRONTEND_URL`.
5. **`trust proxy`** is configured so `req.ip` is the browser's address (Vercel → Render adds hops). The exact value is verified in the M2 walking skeleton. Rate limiting depends on it (ADR-0031).
6. **`Cache-Control: no-store`** on every API response (ADR-0019).

## Alternatives considered
| Option | Rejected because |
|---|---|
| Custom domain `app.example.com` + `api.example.com` (same site) | Best option, but costs a domain (~10 USD/year). **Preferred upgrade** if a domain is bought for email (ADR-0029): then the proxy can be dropped and the cookie stays `Lax` |
| Keep `SameSite=None` | Broken on Safari; CSRF exposure |
| Refresh token in `localStorage` | One XSS steals a 7-day session (Decision #5) |
| WebSocket through Vercel rewrites | Vercel's WebSocket support is new (beta in 2026) and not documented for external rewrites; not worth the risk when the socket needs no cookie |

## Consequences
- Code changes in M2: cookie options, an Origin guard, `trust proxy`, the `no-store` header, Vite proxy and `vercel.json`.
- One extra hop through the Vercel edge (a few ms). API traffic counts toward Vercel bandwidth (negligible, WORKFLOW.md §3).
- Verified by the M2 E2E smoke test: login → reload → still logged in, in Safari as well.
