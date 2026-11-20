# ADR-0018: Modular monolith, one process, one instance

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- Render's free tier gives 750 instance-hours per month: exactly **one** always-on service (WORKFLOW.md §3 NFR).
- One developer. Design target: 100 concurrent sockets, 20 requests/s. One Node process handles that.
- Several features hold short-lived state (typing timers, online presence, rate-limit counters).

## Decision
- **One NestJS deployable** containing the HTTP API, the Socket.io gateway, the BullMQ workers and the schedulers.
- **Modular inside:** one Nest module per feature (RULE.md §1). Modules call each other's exported services for reads and checks. Side effects that cross modules go through domain events (ADR-0026).
- **One instance.** In-process state is allowed only for **ephemeral** data that may be lost on restart: typing timers, presence counters, rate-limit counters. Each sits behind an interface (`PresenceStore`, throttler storage) so it can move to Redis without touching callers.

### Scale-out path (documented, not built)
1. Socket.io Redis adapter, so an event emitted on one instance reaches sockets on another.
2. `PresenceStore` and throttler storage moved to Redis.
3. Workers in a second process from the same code base (`APP_ROLE=worker`).
4. Schedulers already de-duplicate across instances (BullMQ repeatable jobs, ADR-0027).

All four need paid hosting. Nothing in the code may assume a single instance outside the interfaces above.

## Alternatives considered
| Option | Rejected because |
|---|---|
| Microservices (auth, chat, board…) | Distributed transactions and deployment cost with no benefit at this scale; the free tier hosts only one service |
| Separate worker service | A second always-on service exceeds 750 h/month |

## Consequences
- A slow job steals CPU from requests on a 0.1-CPU instance: jobs must be light (HTTP email API, indexed scans, batches), queue concurrency 1.
- Graceful shutdown order: stop accepting HTTP → close workers (finish the active job) → disconnect sockets → disconnect Prisma.
- "Why a monolith?" has a written answer, with numbers.
