# ADR-0016: Password reset deferred; rate limiting deferred

- **Status:** Amended by ADR-0031 (rate limiting ships before the first deploy) and ADR-0037 (milestones renumbered)
- **Date:** 2026-11 (Milestone 1)

## Decision
- `forgot-password` / `reset-password` need email sent through the queue: built in the notifications & jobs milestone (now **M6**).
- Rate limiting on login/register was deferred to a hardening branch. **Amended:** it ships in M2, before the API is reachable from the internet (ADR-0031).
