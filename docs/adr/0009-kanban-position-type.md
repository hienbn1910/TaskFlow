# ADR-0009: Kanban `position` type

- **Status:** Deferred to the Kanban milestone (now M5, see ADR-0037)
- **Date:** 2026-11 (Milestone 1)

## Context
WORKFLOW.md §4 declared `position INTEGER`, §6 described gap-based positioning, which needs fractions.

## Proposal
`Float` (double precision), gap 1000, rebalance a column when the gap between neighbours drops below 1. A move runs in one transaction that locks the affected column rows (`SELECT … FOR UPDATE`), so two users dragging at once cannot produce equal positions. To be decided when the board is built.
