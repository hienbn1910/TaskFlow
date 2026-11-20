# ADR-0028: Deadline reminders by an hourly scan

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
The plan described two mechanisms at once:
- WORKFLOW.md §6 Feature 4: "schedule a reminder job when assigning";
- Milestone 5: "every hour, check tasks due in 24 h".

A delayed job disappears when Redis restarts (ADR-0027) and must be cancelled whenever the due date changes. An hourly scan without a marker sends the same reminder 24 times.

## Decision
- `tasks.reminderSentAt` (nullable).
- `reminders.scan` (hourly) selects, in batches of ≤ 500:
  `completedAt IS NULL AND assigneeId IS NOT NULL AND reminderSentAt IS NULL AND dueDate BETWEEN now() AND now() + 24h`.
- For each task, in one transaction: set `reminderSentAt = now()` and create the `TASK_DUE_SOON` notification. After commit: realtime push and email job.
- Changing `dueDate` or `assigneeId` resets `reminderSentAt` to `NULL`.
- The reminder email is best effort with retries. Losing one because Redis restarted is accepted; the in-app notification is not lost.
- Index: `tasks(dueDate)`.

## Consequences
- Precision: the reminder arrives 23–24 h before the deadline. Accepted.
- A task created already due in less than 24 h gets its reminder at the next tick.
