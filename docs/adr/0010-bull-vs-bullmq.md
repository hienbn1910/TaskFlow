# ADR-0010: Bull vs BullMQ

- **Status:** Superseded by ADR-0027 (BullMQ)
- **Date:** 2026-11 (Milestone 1, deferred)

## Context
Bull is in maintenance mode. BullMQ is its successor. The choice was deferred to the background-jobs milestone.

## Decision
Resolved early by ADR-0027, because the queue library decides how many Redis commands are used, which decides where Redis can be hosted on a free tier.
