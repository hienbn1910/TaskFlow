# ADR-0039: Test first, at seams agreed in the plan

- **Status:** Accepted, amended in M2 (point 5)
- **Date:** 2026-11-21

## Context
- RULE.md §0 wrote code first and tests after ("Generate Code → Generate Tests"). Tests written after the code tend to confirm what the code does rather than what the spec asks.
- RULE.md §7 required a unit test for every service method. In M1 these tests mock the repository (46 unit tests mock the project's own classes). They break on refactors that keep behaviour, and they cannot catch the failures this project fears most: cross-tenant leaks, unique constraints, transactions (ADR-0021, ADR-0032). The 47 integration tests against the real test database catch those.
- The project adopted the `tdd` agent skill (`.claude/skills/tdd/`), whose rules are "red before green" and "mock only system boundaries".
- The developer is learning and writes the important parts of the code.

## Decision
1. **Red → green, one slice at a time.** For every behaviour: write a failing test, run it red, write the minimal code to turn it green, repeat. Refactoring comes after, in the review step (RULE.md §0).
2. **Seams.** The primary seam is the HTTP endpoint, tested against the real application and the real test database. Socket events are tested the same way. Unit tests are for pure logic (rules, mappers, utils, schemas, position maths) and for service branches that HTTP cannot reach. Database guarantees (hashing, cascades, constraints) are tested at the repository against the test database.
3. **Seams are approved in the plan.** `docs/plans/<branch>.md` lists "Seams under test" (one line each: catches / misses). Approving the plan approves the seams.
4. **Mock only system boundaries:** time, bcrypt, Cloudinary, the mail adapter, the queue. Never repositories, services, guards, Prisma or the database in new tests. Existing mocked unit tests stay until a refactor breaks them; then they are replaced by an endpoint test.
5. **Learning mode.** For the important (⚠️) parts, the agent writes the failing test **and** the code, explains both, and stops for the developer's review before the next part. **Amended in M2:** until M1 the developer wrote the green code; from M2 on the developer reviews it instead (speed, while every ⚠️ part stays explained and approved).

## Alternatives considered
| Option | Rejected because |
|---|---|
| Keep code-first and unit tests with mocked repositories | The tests miss the bugs that matter here and break on harmless refactors |
| Endpoint tests only, no unit tests at all | Pure logic (Kanban positions, signature checks, rules) is clearer and faster to test directly |

## Consequences
- The integration suite grows; it stays fast because the test database runs on tmpfs (Decision #3).
- RULE.md §0, §7, CLAUDE.md and WORKFLOW.md §9 are rewritten accordingly.
- Each branch's task list marks the ⚠️ parts, so the parts that need a closer review are visible before coding starts.
