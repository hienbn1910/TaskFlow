import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { sha256Hex } from '@common/utils/hash.util';
import { RefreshTokenRepository } from '@modules/auth/refresh-token.repository';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';

/**
 * Concurrency of RefreshTokenRepository.rotate against real PostgreSQL.
 * Tested directly, not through HTTP: in a full request, JWT verification and signing delay
 * the two calls enough that they almost never overlap, so an HTTP test cannot tell a correct
 * rotate from a find-then-delete one. Here both queries really race.
 */
describe('RefreshTokenRepository.rotate (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let repository: RefreshTokenRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    repository = app.get(RefreshTokenRepository);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  const expiresAt = (): Date => new Date(Date.now() + 60_000);

  const createSession = async (tokenHash: string): Promise<string> => {
    const user = await prisma.user.create({
      data: { email: 'race@example.com', password: 'hash', fullName: 'Race' },
    });
    await repository.create({ userId: user.id, tokenHash, expiresAt: expiresAt() });
    return user.id;
  };

  it('should let exactly one of two parallel rotations of the same token win', async () => {
    const oldHash = sha256Hex('old');
    const userId = await createSession(oldHash);

    const results = await Promise.all([
      repository.rotate(oldHash, { userId, tokenHash: sha256Hex('new-a'), expiresAt: expiresAt() }),
      repository.rotate(oldHash, { userId, tokenHash: sha256Hex('new-b'), expiresAt: expiresAt() }),
    ]);

    expect(results.sort()).toEqual([false, true]);
    expect(await prisma.refreshToken.count({ where: { userId } })).toBe(1);
  });

  it('should write nothing when the old token does not exist', async () => {
    const userId = await createSession(sha256Hex('other'));

    const rotated = await repository.rotate(sha256Hex('missing'), {
      userId,
      tokenHash: sha256Hex('new'),
      expiresAt: expiresAt(),
    });

    expect(rotated).toBe(false);
    const hashes = (await prisma.refreshToken.findMany({ where: { userId } })).map((t) => t.tokenHash);
    expect(hashes).toEqual([sha256Hex('other')]);
  });
});
