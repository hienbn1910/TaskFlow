---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or editing an ADR.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `GLOSSARY.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

Most repos have a single context:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `GLOSSARY-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Create files lazily: only when you have something to write. If no `GLOSSARY.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `GLOSSARY.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

When a term is resolved, update `GLOSSARY.md` right there. Don't batch these up: capture them as they happen. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` should be totally devoid of implementation details. Do not treat `GLOSSARY.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

## Adaptations for TaskFlow

These rules extend the upstream skill for this repository. Where they differ, they win.

1. **One context.** TaskFlow has a single domain (workspaces, chat, boards) shared by `apps/api` and `apps/web`: one `GLOSSARY.md` at the repo root, no `GLOSSARY-MAP.md`. The two apps of the monorepo are not separate contexts.
2. **Two glossaries, two jobs.** `GLOSSARY.md` holds the **domain** language (Workspace, Member, Invitation, Channel…), in English, the words used in code and API. `WORKFLOW-VI.md` §11 explains **technical** concepts (JWT, transaction, outbox…) in Vietnamese for learning. Never move terms between them.
3. **Cross-reference with the documents too.** Besides the code, check the user's statements against `apps/api/prisma/schema.prisma`, `WORKFLOW.md` §4 (tables), §5 (API) and §6 (feature rules), and the ADRs. A contradiction with an accepted ADR is surfaced like a contradiction with code.
4. **Language of the session.** Talk with the user in Vietnamese; write `GLOSSARY.md` and ADRs in English.
5. **Renaming has a cost.** If sharpening a term means renaming something that already exists in code, the API or the database, say so and propose it as a separate task (with an expand → contract plan for API and schema, ADR-0036). Update `GLOSSARY.md` now; do not rename code during the session.
6. **ADRs follow the project format and rules** described in the adaptations of [ADR-FORMAT.md](./ADR-FORMAT.md) and in `docs/adr/README.md`. Offer an ADR, write it only when the user agrees (same rule as the `grilling` skill).
