---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows) - not the current workspace.

Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

## Adaptations for TaskFlow

1. **Where it goes.** The OS temp folder, as upstream says (on this machine `%TEMP%`, i.e. `C:\Users\<user>\AppData\Local\Temp`). Name it `taskflow-handoff-<YYYY-MM-DD>-<branch>.md` and give the developer the **full absolute path**.
2. **Always include the position in the work**, with references instead of copies:
   - current milestone (CLAUDE.md "Current Milestone") and branch, last commit (`git log -1 --oneline`), uncommitted changes (`git status --short`);
   - the task list `docs/tasks/<branch>.md`: which task is done, which one is next;
   - the test-first state of the current task (ADR-0039): no test yet / test red / waiting for the developer to write the code (⚠️ part) / green;
   - open questions waiting for the developer, quoted exactly;
   - merged branches not yet deleted, if any.
3. **Suggested skills** come from this repository's set (`.claude/skills/README.md`): `grilling` / `grill-me`, `domain-modeling` / `grill-with-docs`, `tdd`, `diagnosing-bugs`, `review-against-spec`, `pr`.
4. **Do not copy the developer's working preferences** into the document: the next agent reads them from its own memory and from `CLAUDE.md`.
5. Write the document in English; tell the developer in Vietnamese where it is.
