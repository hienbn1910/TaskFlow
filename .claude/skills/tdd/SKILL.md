---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

When exploring the codebase, read `GLOSSARY.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?" Give each proposed seam a one-line note on what it catches and what it misses.

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.

## Adaptations for TaskFlow

These rules extend the upstream skill for this repository. Where they differ, they win. The decision behind them is ADR-0039; the binding rules are RULE.md §0 and §7.

### Seams of this project

| Seam | Test kind | Where | Catches | Misses |
|---|---|---|---|---|
| **HTTP endpoint** (primary) | Integration: real app (`setupApp`) + supertest + the real test database | `apps/api/test/*.e2e-spec.ts` | Validation, guards, tenant isolation, unique constraints, transactions, response shape | Frontend behaviour |
| **Socket event** | Integration: real app + `socket.io-client` | `apps/api/test/*.e2e-spec.ts` | Room authorization, event payloads, disconnect rules (ADR-0025) | Delivery under bad networks |
| **Pure logic** | Unit | `src/**/__tests__/*.spec.ts` | Rules (`user.rules.ts`), mappers, utils, Zod schemas, position maths, signature checks | Wiring, database behaviour |
| **Repository guarantee** | Integration against the test database | `apps/api/test/*.repository.e2e-spec.ts` | Behaviour that only the database can show (a token stored as a hash, a cascade, a partial unique index) | Business rules |
| **Frontend** (from M2) | Vitest + Testing Library; Playwright for critical flows (M7) | `apps/web` (RULE.md §11) | Hooks, forms, refresh flow, realtime cache updates | Server behaviour |

A service is tested **through its endpoint**. Write a unit test for a service only for a branch that cannot be reached through HTTP, and then mock only system boundaries.

### Agreeing the seams

The seams for a branch are listed in its plan, `docs/plans/<branch>.md`, under **"Seams under test"**: one line per seam, saying what it catches and what it misses. The developer approves them with the plan (RULE.md §0 Step 2). During the tasks, do not ask again; ask only if a task needs a seam the plan does not list.

### Mocking in this project

`mocking.md` applies, with these specifics:
- **Never mock** repositories, services, guards or Prisma in new tests. The database is never mocked: use `postgres-test` (RULE.md §7, Decision #3), reset with `test/utils/reset-db.ts`.
- **Mock only system boundaries:** time (Jest fake timers), bcrypt (speed), Cloudinary, the mail adapter (Resend), the queue / Redis when the test is not about jobs.
- Existing unit tests that mock repositories (written in M1) stay as they are. When one breaks during a refactor without a behaviour change, replace it with an endpoint test instead of fixing the mock.

### Side-channel exception

Checking through the database instead of the interface is an anti-pattern **unless the behaviour under test is a database guarantee** that no interface exposes: a secret stored only as a hash, a cascade delete, a constraint. Those tests belong to the "Repository guarantee" seam.

### Learning mode (who writes what)

- For the important parts (marked ⚠️ in `docs/tasks/<branch>.md`): **the agent writes the failing test**, runs it and shows it red, **then writes the code** that turns it green, runs the suite, explains both and **stops for the developer's review** before the next part (ADR-0039, amended in M2).
- For simple parts, the agent does both, one slice at a time.

### Commands

```bash
docker compose up -d --wait && pnpm --filter api db:migrate:test   # once, before integration tests
pnpm --filter api test -- <path or pattern>        # one unit test file
pnpm --filter api test:e2e -- <path or pattern>    # one integration test file
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e           # full suite, before the PR
```

### Naming and vocabulary

- Test names follow RULE.md §7 (`should … when …`) and describe behaviour, using `GLOSSARY.md` terms ("should return 404 when the User is not a Member").
- Expected values are literals or come from the spec, never recomputed like the code does (see "Tautological").

### References in this file that do not apply

- The `codebase-design` skill is not used in this project: for module and layer vocabulary use RULE.md §1 and §3.
- The `code-review` skill is installed here as `review-against-spec`. Refactoring happens in RULE.md §0 Step 9, after the review.
