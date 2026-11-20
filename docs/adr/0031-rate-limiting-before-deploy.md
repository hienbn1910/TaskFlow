# ADR-0031: Rate and abuse limits ship before the API is public

- **Status:** Accepted (amends Decision #16)
- **Date:** 2026-11-21

## Context
- Decision #16 left rate limiting to a late hardening branch. With the API deployed in M2 (ADR-0037), login would be open to brute force for months.
- Invitations send email to any address: without a limit the app becomes a spam tool and burns the 100 emails/day quota (WORKFLOW.md §3).
- Each bcrypt hash costs ~1 s of a 0.1-CPU instance: unthrottled login attempts are also a cheap denial of service.

## Decision
- `@nestjs/throttler` with **in-memory storage** (one instance, ADR-0018; no Redis commands). Keys: IP (needs `trust proxy`, ADR-0020) and/or user id.
- Responses: 429 with `Retry-After`, standard error body (Decision #1).

| Scope | Limit | Milestone |
|---|---|---|
| `POST /auth/login` | 5/min per IP + email; 20/min per IP | M2 |
| `POST /auth/register` | 5/hour per IP | M2 |
| `POST /auth/refresh` | 30/min per IP | M2 |
| `PATCH /users/password` | 5 / 15 min per user | M2 |
| Any authenticated route | 120/min per user | M2 |
| Any anonymous route | 60/min per IP | M2 |
| Create invitation | 20/day per workspace | M3 |
| Send message | 10 / 10 s per user | M4 |
| Upload signature | 30/hour per user | M4 |
| Socket events | 20 / 10 s per socket (ADR-0025) | M4 |
| `POST /auth/forgot-password` | 3/hour per email and per IP | M6 |

## Consequences
- Counters reset on restart (in memory): acceptable for this purpose.
- Integration tests assert the 429 on login and on invitations.
