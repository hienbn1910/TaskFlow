# Project skills

Agent skills used in this repository. Claude Code loads every `.claude/skills/<name>/SKILL.md` automatically. They are committed and reviewed like code: changing a skill changes how the agent works on this project.

## Source and license

Skills marked "vendored" are copied from **[mattpocock/skills](https://github.com/mattpocock/skills)** (MIT License, © 2026 Matt Pocock, full text in [LICENSE-mattpocock-skills](LICENSE-mattpocock-skills)).

- Upstream commit: `abeeaf95660ba9e8b7c753eb38f441ca707a8823` (2026-11-19)
- Only `SKILL.md` and the files it links to are copied. `agents/openai.yaml` (Codex configuration) is not.
- Each vendored skill is **adapted** to this project. Every change from upstream is listed in the table below, and in the skill itself under a final section "Adaptations for TaskFlow".

## Skills

| Skill | Upstream path | Invoked by | Used in (RULE.md §0) | Changes from upstream | Status |
|---|---|---|---|---|---|
| `grilling` | `skills/productivity/grilling/` | model | Step 1 Spec, open ADR questions | Vietnamese trigger phrases; "Adaptations": Vietnamese rounds, read ADRs first and never re-ask settled decisions, ≤ 5 questions per round, recommendations cite NFR/ADR, outcome written to `docs/specs/` or a proposed ADR | Vendored |
| `grill-me` | `skills/productivity/grill-me/` | user (`/grill-me`) | Same, started by the developer | None (calls `grilling`) | Vendored |
| `domain-modeling` | `skills/engineering/domain-modeling/` (+ `ADR-FORMAT.md`, `GLOSSARY-FORMAT.md`) | model | Steps 1–2, `GLOSSARY.md` and ADRs | "Adaptations": one context; domain glossary (EN) ≠ technical glossary (`WORKFLOW-VI.md` §11); cross-check schema / WORKFLOW / ADRs; renames become separate tasks. ADR template, numbering and supersede rules from `docs/adr/README.md`; extra ADR trigger "resolves a document conflict". Glossary: English, optional `_VI_` line, grouped by feature area | Vendored |
| `grill-with-docs` | `skills/engineering/grill-with-docs/` | user (`/grill-with-docs`) | Step 1 when the domain language changes | None (calls `grilling` + `domain-modeling`) | Vendored |
| `tdd` | `skills/engineering/tdd/` (+ `tests.md`, `mocking.md`, verbatim) | model | Steps 4–7 | "Adaptations": the project's seams (HTTP endpoint first, socket, pure logic, repository guarantee, frontend); seams approved in the plan; never mock own classes or the database, only system boundaries; side-channel exception for database guarantees; learning mode (agent writes red, developer writes green for ⚠️ parts); commands; references to `codebase-design` / `code-review` redirected (ADR-0039) | Vendored |
| `diagnosing-bugs` | `skills/engineering/diagnosing-bugs/` (+ `scripts/hitl-loop.template.sh`, verbatim) | model | Step 7, bug fixes | "Adaptations": project feedback loops (e2e test first, unit, curl, production via `requestId`), HITL script run by the developer (agent shell not interactive), project secrets to redact, wait for the developer on hypotheses, `[DEBUG-]` via `Logger`, regression test seams, `Root cause:` line in the commit, perf against WORKFLOW §3 | Vendored |
| `review-against-spec` | `skills/engineering/code-review/` | model | Step 8 | Renamed (`name:` line only) to avoid the built-in `/code-review`. "Adaptations": no issue tracker (spec from `docs/specs|plans|tasks`, WORKFLOW §6–§7, ADRs), default fixed point `main`, standards = RULE.md + CLAUDE.md "Do NOT" + GLOSSARY + ADRs, skip ESLint-enforced rules, Middle Man / ADR-required interfaces not flagged, sequential fallback without sub-agents, Vietnamese report, no fixing during review | Vendored |
| `pr` | `skills/engineering/pr/` (+ `CREDITS.md`, verbatim) | model | Step 10 | "Adaptations": the agent writes a ready-to-paste title and body, the developer opens the PR; RULE §8 titles; English; no AI attribution; extra "Decisions" section; project evidence (test counts, red → green); project one-way doors (destructive migrations, merged ADRs, secrets / cookies / isolation); stacked-branch note | Vendored |
| `handoff` | `skills/productivity/handoff/` | user (`/handoff`) | Long sessions | "Adaptations": file name and full path in `%TEMP%`; always records milestone, branch, last commit, task position and test-first state, open questions, merged branches to delete; suggests this repo's skills; no copy of working preferences | Vendored |

## Deliberately not used

| Upstream skill | Why not |
|---|---|
| `implement`, `implement-spec` | The agent would implement whole tickets (or several in parallel worktrees) on its own. This project works one small task per turn, and the developer writes the important parts |
| `triage`, `wayfinder`, `to-tickets`, `to-spec` | Built around a GitHub / GitLab issue tracker (`gh`, labels). This project keeps specs and tasks in `docs/specs/` and `docs/tasks/` (RULE.md §0) |
| `setup-matt-pocock-skills` | Configures the issue tracker and labels for the skills above |
| `codebase-design` | Its vocabulary avoids "service" and "API"; this project uses NestJS's Controller → Service → Repository terms (RULE.md §3). Revisit with `improve-codebase-architecture` after M4 |
| `improve-codebase-architecture`, `prototype`, `retro`, `teach`, `writing-for-agents` | Useful later (after M3–M4, from M2 for UI prototypes). Add them in a later branch, one at a time |
| `ask-matt`, `wait-what`, `to-questionnaire`, `research`, `wizard` | Low value for a one-person project, or need `gh` |

## Rules for changing a skill

1. A skill is part of the development process: change it in a branch and a PR, like code.
2. Keep upstream wording where possible. Put project-specific rules in the "Adaptations for TaskFlow" section, so a later upstream update is easy to compare.
3. When a skill conflicts with RULE.md, an ADR or CLAUDE.md, the project documents win: fix the skill.
4. To update from upstream: diff the upstream folder at the new commit against the commit above, re-apply the adaptations, update the commit hash here.
