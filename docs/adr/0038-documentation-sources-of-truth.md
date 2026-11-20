# ADR-0038: Documentation — one source of truth per topic

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
WORKFLOW.md and RULE.md kept text that later decisions had overruled (Passport, `./backend` in compose, error format, Prisma path, project name). Readers (people and AI agents) could not tell which text was current. WORKFLOW-VI.md duplicated WORKFLOW.md and drifted with it.

## Decision
| Topic | Source of truth |
|---|---|
| Implemented tables | `apps/api/prisma/schema.prisma` |
| Tables not built yet | WORKFLOW.md §4 (marked "planned"; becomes "implemented → see schema.prisma" once built) |
| Decisions and their reasons | `docs/adr/` |
| Plan, API, feature specs, NFR | WORKFLOW.md |
| Code rules | RULE.md |
| Entry point, current status, commands | CLAUDE.md |
| Per-branch spec, plan, tasks | `docs/specs/`, `docs/plans/`, `docs/tasks/` |

Rules:
1. When an ADR changes something, the affected text in WORKFLOW.md / RULE.md is **corrected in the same PR**. Overruled text is not left in place.
2. **WORKFLOW-VI.md** is the Vietnamese translation of WORKFLOW.md plus a glossary. It is updated in the same PR as any WORKFLOW.md change. If they disagree, the English file wins.
3. The last task of every branch: update CLAUDE.md status, the ADR index and WORKFLOW-VI.md if needed.

## Consequences
More files touched per PR, but every document can be trusted as written.
