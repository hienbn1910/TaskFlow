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
| `grilling`, `grill-me` | `skills/productivity/` | model / user | Step 1 Spec, open ADR questions | — | Planned (task 2) |
| `domain-modeling`, `grill-with-docs` | `skills/engineering/` | model / user | Step 1–2, glossary and ADRs | — | Planned (task 3) |
| `tdd` | `skills/engineering/tdd/` | model | Steps 4–7 | — | Planned (task 5) |
| `diagnosing-bugs` | `skills/engineering/diagnosing-bugs/` | model | Bug fixes | — | Planned (task 7) |
| `review-against-spec` | `skills/engineering/code-review/` | model | Step 8 | — | Planned (task 8) |
| `pr` | `skills/engineering/pr/` | model | Step 10 | — | Planned (task 9) |
| `handoff` | `skills/productivity/handoff/` | user | Long sessions | — | Planned (task 10) |

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
