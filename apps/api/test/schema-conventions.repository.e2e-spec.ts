import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Database guarantees of ADR-0023 ("every DateTime is timestamptz(3)"), checked against the
 * real schema. They protect every table added later too, so they live in their own file.
 */
describe('Schema conventions (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  it('should have no timestamp column without time zone in the public schema', async () => {
    const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'timestamp without time zone'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name, column_name`;

    expect(columns).toEqual([]);
  });

  /**
   * @prisma/adapter-pg sends DateTime parameters without an offset, so PostgreSQL reads them in
   * the session time zone. Every write is correct only while the session runs in UTC: the
   * database default is pinned by a migration, and this test fails if that is ever lost.
   */
  it('should run application sessions in UTC', async () => {
    const rows = await prisma.$queryRaw<{ TimeZone: string }[]>`SHOW TIME ZONE`;

    expect(rows).toEqual([{ TimeZone: 'UTC' }]);
  });

  it('should read back the same instant that was written', async () => {
    const instant = new Date('2026-11-22T10:15:30.123Z');
    const { id } = await prisma.user.create({
      data: { email: 'hien@example.com', password: 'hash', fullName: 'Hien', lastLoginAt: instant },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });

    expect(user.lastLoginAt?.getTime()).toBe(instant.getTime());
  });

  /**
   * The bug ADR-0023 prevents: with `timestamp without time zone`, PostgreSQL compares the
   * stored UTC wall-clock value with now() converted to the SESSION time zone, so a session
   * outside UTC is off by its offset (+7 h in Vietnam). With timestamptz both sides are instants.
   * Written in the normal (UTC) session: only the comparison runs in the other time zone,
   * because @prisma/adapter-pg sends DateTime parameters without an offset: a WRITE in a
   * non-UTC session would itself store a shifted instant (a separate concern from this column type).
   */
  it('should compare a stored instant with now() correctly when the session time zone is not UTC', async () => {
    const inOneHour = new Date(Date.now() + HOUR_MS);
    await prisma.user.create({
      data: {
        email: 'hien@example.com',
        password: 'hash',
        fullName: 'Hien',
        lastLoginAt: inOneHour,
      },
    });

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'`;
      return tx.$queryRaw<{ in_future: boolean }[]>`
        SELECT last_login_at > now() AS in_future FROM users WHERE email = 'hien@example.com'`;
    });

    expect(rows).toEqual([{ in_future: true }]);
  });
});
