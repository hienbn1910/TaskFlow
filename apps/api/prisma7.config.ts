import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * The Prisma CLI (migrate, studio) uses the DIRECT connection when one is set: Neon's pooled
 * URL goes through PgBouncer, which migrations cannot use (advisory locks, ADR-0036). The app
 * itself always uses DATABASE_URL (pooled). Locally both are the same database, so
 * DIRECT_DATABASE_URL can stay unset. `||`, not `??`: an empty `DIRECT_DATABASE_URL=` line
 * counts as unset.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_DATABASE_URL'] || process.env['DATABASE_URL'],
  },
});
