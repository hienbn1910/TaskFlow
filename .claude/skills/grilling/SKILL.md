---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases (also Vietnamese ones such as "hỏi vặn", "phỏng vấn kỹ", "chất vấn kế hoạch").
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent with a fresh context window to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

## Adaptations for TaskFlow

These rules extend the upstream skill for this repository. Where they differ, they win.

1. **Language.** Ask the questions and recommended answers in Vietnamese. Keep technical terms, code names and file paths in English.
2. **Settled decisions are facts, not questions.** Before the first round, read what the project has already decided: `CLAUDE.md`, the ADRs in `docs/adr/` (index: `docs/adr/README.md`), `RULE.md`, the relevant parts of `WORKFLOW.md`, and `apps/api/prisma/schema.prisma`. Do not ask the user to decide again what an accepted ADR already decides. If a question would **reverse** an ADR, say so in the question ("this would supersede ADR-00NN") and give the cost of reversing it.
3. **Looking up facts.** Look facts up yourself with the file and search tools. Use a sub-agent only for a broad search across many files, and only when the harness allows it.
4. **Round size.** The developer is learning and prefers a steady pace. If the frontier holds more than 5 questions, ask the 5 most fundamental ones (those that unblock the most other decisions) and keep the rest for the next round.
5. **Recommendations.** Base each recommended answer on the project's constraints: the NFR and free-tier budget (`WORKFLOW.md` §3), the ADRs, and RULE.md. Name the source in one short clause (for example "theo ADR-0027").
6. **Grilling decides; it does not test knowledge.** A self-check quiz about what the developer has learned is a different activity: there, the answer is not revealed before the developer answers.
7. **Recording the outcome.** After the user confirms the shared understanding:
   - in the Spec step (RULE.md §0 Step 1), write the result to `docs/specs/<branch>.md`;
   - a decision that is hard to reverse, would surprise a newcomer, and was a real trade-off becomes an ADR, following `docs/adr/README.md` (propose it; write it once the user agrees);
   - otherwise, summarise the decisions in the conversation and stop.
   Do not write code as part of a grilling session.
