# ADR Format

> **TaskFlow:** the template, status values and index rules of this project are in `docs/adr/README.md`. They replace the "Template" and "Optional sections" below. See "Adaptations for TaskFlow" at the end of this file.

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily: only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why*, not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`): useful when decisions are revisited
- **Considered Options**: only when the rejected alternatives are worth remembering
- **Consequences**: only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library: just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it; otherwise someone will suggest GraphQL again in six months.

## Adaptations for TaskFlow

These rules replace the upstream "Template" and "Optional sections", and extend "When to offer an ADR".

1. **Template.** Use the template in `docs/adr/README.md`: title `# ADR-NNNN: …`, then **Status** and **Date**, then **Context** and **Decision** (always). **Alternatives considered** and **Consequences** only when they add value — the upstream advice "an ADR can be short" applies.
2. **Numbers 0001–0017 are fixed.** They are the former "Resolved Decisions #1–#17"; code comments cite them as `Decision #N`. New ADRs continue from the highest number in `docs/adr/`.
3. **Never rewrite an accepted ADR.** To change a decision, write a new ADR and set the old one's status to `Superseded by ADR-XXXX` or `Amended by ADR-XXXX`. Typos and broken links may be fixed in place.
4. **When to offer an ADR:** all three upstream conditions, **or** the decision resolves a conflict between project documents (CLAUDE.md, RULE.md, WORKFLOW.md), which must be recorded so the documents can be corrected.
5. **After writing one:** add it to the index in `docs/adr/README.md` and to the summary table in `CLAUDE.md`, and correct any text it overrules in `WORKFLOW.md`, `WORKFLOW-VI.md` and `RULE.md` in the same branch (ADR-0038).
