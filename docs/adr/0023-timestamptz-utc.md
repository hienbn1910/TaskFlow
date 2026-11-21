# ADR-0023: Every timestamp is `timestamptz`, stored and sent in UTC

- **Status:** Accepted (amended 2026-11-22: database session time zone pinned to UTC)
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

5. **Amended (2026-11-22, M2): the database session time zone is pinned to UTC.** Measured while converting the columns: `@prisma/adapter-pg` sends `DateTime` parameters as text **without an offset**, so PostgreSQL reads them in the session time zone. Writing `10:00Z` in a session set to `Asia/Ho_Chi_Minh` stored `03:00Z`, even in a `timestamptz` column. `timestamptz` makes comparisons correct; only a UTC session makes writes correct.
   - A migration runs `ALTER DATABASE <current> SET timezone TO 'UTC'`, so every new connection starts in UTC, including connections through Neon's pooled endpoint.
   - Rejected: `options: '-c TimeZone=UTC'` on the pg pool, because PgBouncer may reject startup parameters. Rejected: relying on the provider default, because nothing would fail when it changed.
   - An integration test asserts `SHOW TIME ZONE` = `UTC`. Never `SET TIME ZONE` in application code.

## Consequences
- One migration now instead of a migration of every table later.
- Integration tests compare instants (`getTime()`), not strings.
