# ADR-0023: Every timestamp is `timestamptz`, stored and sent in UTC

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
- Prisma's default `DateTime` maps to `timestamp(3) without time zone`. Prisma writes UTC, so today's values are correct.
- Raw SQL (`now()`, date arithmetic in the reminder scan), or any tool whose session time zone is not UTC, would read these columns wrongly.
- Deadline reminders ("24 h before") depend on correct instants. The cost of switching grows with every new table.

## Decision
1. Every `DateTime` column is declared `@db.Timestamptz(3)`.
2. The API sends ISO 8601 strings with `Z`. The frontend formats them in the user's local time zone.
3. Due dates are full instants (date + time), picked in local time and sent as UTC.
4. The existing `users` and `refresh_tokens` columns are converted in M2 with
   `ALTER COLUMN … TYPE timestamptz(3) USING <col> AT TIME ZONE 'UTC'`.
   **Not** the default conversion, which interprets old values in the session time zone. Review the generated SQL by hand.

## Consequences
- One migration now instead of a migration of every table later.
- Integration tests compare instants (`getTime()`), not strings.
