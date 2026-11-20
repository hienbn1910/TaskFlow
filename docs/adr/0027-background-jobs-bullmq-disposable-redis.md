# ADR-0027: BullMQ on Render Key Value; Redis is disposable; one hourly tick

- **Status:** Accepted (supersedes ADR-0010)
- **Date:** 2026-11-21

## Context (numbers from WORKFLOW.md §3)
- Upstash free: 500K commands/month ≈ 11/minute. One idle BullMQ queue with default settings ≈ 14/minute. Over budget before any traffic.
- Render Key Value free: no command limit, same region, but **in-memory only**: a restart (at any time) loses everything.
- Neon free: ≤ 400 awake hours/month. Anything that touches the database every few minutes keeps it awake all month.

## Decision
1. **Library:** BullMQ (Bull is maintenance-only).
2. **Host:** Render Key Value in production; the `redis` container locally.
3. **Redis is disposable.** PostgreSQL is the only source of truth. The queue may be emptied at any moment, so:
   - no delayed job scheduled far in the future: reminders are derived by an hourly scan (ADR-0028);
   - repeatable jobs are registered again at every start-up;
   - every email that must be sent is recorded as a column in PostgreSQL (ADR-0026).
4. **Queues**
   - `email`: concurrency 1, 5 attempts, exponential backoff from 30 s, keep the last 100 completed and 500 failed jobs.
   - `maintenance`: repeatable jobs only.
5. **One tick per hour.** All periodic jobs run at minute `:00`, so the database wakes once per hour:
   - `reminders.scan`: hourly (ADR-0028);
   - `email.sweep`: hourly (ADR-0026);
   - `cleanup`: daily at 20:00 UTC (03:00 in Vietnam). Deletes notifications older than 90 days and expired refresh tokens.
6. Worker options keep Redis traffic low (`drainDelay` 30 s, `stalledInterval` 5 min). Not needed on Render Key Value, but it saves CPU and keeps Upstash possible.
7. Workers run inside the API process (ADR-0018).
8. **If Redis is down:** HTTP keeps working, enqueue failures are logged, the sweep recovers them, and `/health/ready` reports the failure (ADR-0035).

## Alternatives considered
| Option | Rejected because |
|---|---|
| Upstash Redis | Command quota smaller than BullMQ's idle polling |
| pg-boss (queue in PostgreSQL) | Polls every few seconds: Neon never sleeps, compute quota gone around day 16 |
| `@nestjs/schedule` cron only, no queue | Would work with the DB-flag design. Rejected because retries with backoff, job visibility and a scale-out path are part of what the project demonstrates. Kept as the fallback if Redis hosting becomes a problem |

## Consequences
- Losing Redis costs at most one hour of delay for emails, never data.
- The hourly tick defines the reminder precision (23–24 h before the deadline).
