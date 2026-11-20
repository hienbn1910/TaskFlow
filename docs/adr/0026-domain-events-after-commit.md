# ADR-0026: Domain events after commit; three consistency levels for side effects

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- The plan had services call the WebSocket gateway directly: business logic coupled to transport, and features depending on later milestones (task assignment → notifications).
- Emitting inside a transaction shows clients data that may still roll back. Enqueueing a job after commit can fail (Redis down), and the email is silently lost.

## Decision

### Domain events
- Services publish typed domain events with `@nestjs/event-emitter` **after the write has committed**: after the repository call or `$transaction` returns, never inside a transaction callback.
- Internal names use dots: `message.created`, `task.assigned`, `member.joined`, `invitation.created`. One class per event; payload = ids + the minimal data listeners need.
- Listeners (gateway, notifications, mail) run asynchronously. Their errors are caught and logged; they never fail the request.

### Consistency levels
| Level | Examples | Guarantee | Mechanism |
|---|---|---|---|
| 1. Business data | Create message, accept invitation | All or nothing | One transaction |
| 2. Real-time pushes, in-app notifications | `message:created`, `TASK_ASSIGNED` notification | Best effort | Listener after commit. A crash between commit and listener loses the push; clients recover through resync (ADR-0025). A missing in-app notification is accepted |
| 3. Emails | Invitation, password reset, email verification | At least once | The need is a **column in PostgreSQL written in the same transaction** (`emailSentAt IS NULL`). The job is enqueued after commit with a deterministic `jobId` (deduplication). The worker sets `emailSentAt` once the provider accepted. The hourly sweep re-enqueues rows still unsent after 10 minutes (ADR-0027) |

Level 3 is a transactional outbox without a separate outbox table: the business row is the outbox.

## Alternatives considered
| Option | Rejected because |
|---|---|
| Services call the gateway / other modules directly | Coupling, module cycles (RULE.md §1), forward dependencies between milestones |
| Full outbox table polled every few seconds | One more polling loop that keeps Neon awake (compute budget, WORKFLOW.md §3). The hourly sweep gives the same guarantee for the few email types |

## Consequences
- A milestone publishes events that a later milestone subscribes to (M5 publishes `task.assigned`, M6 adds the notification listener). No forward dependency.
- Job handlers and listeners must be idempotent: running them twice has the same effect as once.
