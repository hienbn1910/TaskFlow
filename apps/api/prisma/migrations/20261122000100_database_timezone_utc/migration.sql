-- Pin the database's default session time zone to UTC (ADR-0023, amended M2). Hand-written.
-- @prisma/adapter-pg sends DateTime parameters as text WITHOUT an offset, so PostgreSQL reads
-- them in the session time zone: in a non-UTC session every write would store a shifted instant.
-- A database-level default applies to every new connection, including those through Neon's
-- pooled endpoint (a startup `options` parameter may be rejected by PgBouncer).
-- Requires ownership of the database (the Neon default role owns it). Not tracked by schema.prisma.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
