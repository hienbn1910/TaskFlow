# ADR-0037: Vertical-slice milestones, deployed from M2

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
The old plan was horizontal: M2–M5 backend only, M6 the whole frontend, M8 the first deploy. It had forward dependencies:

| Milestone | Needed | Which only existed in |
|---|---|---|
| M2 | Auto-create the "general" channel | M3 (`channels`) |
| M2 | Invitation email, expiry job | M5 (queue, email) |
| M3 | Avatar and logo upload | belonged to M1/M2 |
| M4 | "Task assignment notifies assignee" | M5 (notifications) |
| M6 | Forgot-password page | backend deferred to M5 (Decision #16) |
| M7 / M8 | Seed data | listed twice |

Integration risks (cross-site cookie, proxy, free-tier limits) would have been discovered in week 13.

## Decision
1. **Every milestone is a vertical slice:** backend + frontend + tests, deployed to production, demonstrable in a browser.
2. **A milestone may depend only on earlier milestones.** When a feature needs something from a later one, either the feature moves, or the earlier milestone publishes a domain event that the later one subscribes to (ADR-0026).
3. **Deploy from M2** (walking skeleton). After that, every merge to `main` deploys (ADR-0036).
4. New numbering:

| # | Milestone | Was |
|---|---|---|
| M1 | Foundation & Auth API | M1 (done) |
| M2 | Web foundation, auth UI, production walking skeleton | new (parts of old M6, M7, M8) |
| M3 | Workspaces, members, invitations | M2 |
| M4 | Channels & real-time messaging, uploads | M3 |
| M5 | Kanban boards | M4 |
| M6 | Notifications, email, background jobs | M5 |
| M7 | Hardening, polish & launch | M7 + M8 |

## Consequences
- Each milestone takes longer, offset by the UI quality bar "functional first" (ADR-0034).
- References to old numbers are updated: Decision #9 → M5, Decision #16 → M6.
- Full plan in WORKFLOW.md §7.
