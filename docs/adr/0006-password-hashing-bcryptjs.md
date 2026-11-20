# ADR-0006: Password hashing with `bcryptjs`, 10 salt rounds

- **Status:** Accepted (to re-measure in production: WORKFLOW.md §3, "Risks to verify")
- **Date:** 2026-11 (Milestone 1)

## Context
`bcrypt` needs a native build, which often fails on Windows and in CI images.

## Decision
Use `bcryptjs` (same algorithm, pure JavaScript), cost 10.

## Consequences
- No native toolchain needed.
- Pure JS is slower. On Render's 0.1-CPU free instance, login may exceed the 1.5 s target. If the M2 walking skeleton measures that, switch to native `bcrypt`: the hash format is identical, so existing hashes stay valid and nobody has to reset a password.
