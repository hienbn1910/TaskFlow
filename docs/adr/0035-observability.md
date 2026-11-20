# ADR-0035: Observability — structured logs, request id, error tracking, two health endpoints

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- One project goal is to "deploy and **maintain** a live application". Without logs, nobody can say why a request failed in production.
- WORKFLOW.md §3 drew a logger middleware that does not exist.
- A health check that touches the database, if pinged every few minutes, keeps Neon awake all month (WORKFLOW.md §3 compute budget).

## Decision
1. **Logs:** `nestjs-pino`, JSON. One line per request: method, route, status, `responseTime`, `requestId`, `userId`, `workspaceId`. Level from `LOG_LEVEL`. Pino `redact` for the `authorization` header, cookies and password fields; emails and tokens masked with the existing `mask.util` (RULE.md §5).
2. **Request id:** accept an incoming `X-Request-Id` if it is a UUID, otherwise generate one. Returned in the response header and in every error body (`requestId`). Copied into job data and socket logs, so one action can be followed across HTTP, events and jobs.
3. **Error tracking:** Sentry free plan (quota to confirm in M2) for API and web, tagged by environment. User id only, no other personal data.
4. **Health**
   - `GET /api/v1/health`: **liveness**, touches neither the database nor Redis. Used by Render's health check and the keep-alive ping.
   - `GET /api/v1/health/ready`: **readiness**, checks the database and Redis. Used after a deploy and by hand, never by a frequent pinger.
5. **Uptime:** UptimeRobot (free) pings liveness every 5 minutes (keeps Render awake) and emails on failure.
6. **No metrics system.** The latency targets are measured from request logs.

## Consequences
Log retention on Render's free plan is short: logs are for debugging, not analytics.
