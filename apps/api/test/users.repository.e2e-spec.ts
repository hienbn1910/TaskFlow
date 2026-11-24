import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { UsersRepository } from '@modules/users/users.repository';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';

/**
 * UsersRepository writes against real PostgreSQL. Tested directly because the facts that
 * matter here (which rows a nested `deleteMany: {}` touches, what `where` filters out)
 * are decided by Prisma and the database, not by our code, so a mock would prove nothing.
 */
describe('UsersRepository writes (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let repository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    repository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  /** A user with `sessions` refresh tokens. */
  const createUser = async (email: string, sessions: number): Promise<string> => {
    const expiresAt = new Date(Date.now() + 60_000);
    const user = await prisma.user.create({
      data: {
        email,
        password: 'old-hash',
        fullName: 'Old Name',
        refreshTokens: {
          create: Array.from({ length: sessions }, (_, i) => ({
            tokenHash: `${email}-${String(i)}`,
            expiresAt,
          })),
        },
      },
    });
    return user.id;
  };

  const sessionsOf = async (userId: string): Promise<number> =>
    prisma.refreshToken.count({ where: { userId } });

  const softDelete = async (id: string): Promise<void> => {
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  };

  describe('updatePasswordAndRevokeSessions', () => {
    it("should store the new hash and delete ALL of the user's sessions", async () => {
      const userId = await createUser('me@example.com', 3);

      await repository.updatePasswordAndRevokeSessions(userId, 'new-hash');

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.password).toBe('new-hash');
      expect(await sessionsOf(userId)).toBe(0);
    });

    it("should not touch another user's sessions (deleteMany: {} is scoped to the user)", async () => {
      const userId = await createUser('me@example.com', 2);
      const otherId = await createUser('other@example.com', 2);

      await repository.updatePasswordAndRevokeSessions(userId, 'new-hash');

      expect(await sessionsOf(otherId)).toBe(2);
      const other = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
      expect(other.password).toBe('old-hash');
    });

    it('should change nothing for a soft-deleted user', async () => {
      const userId = await createUser('me@example.com', 2);
      await softDelete(userId);

      await expect(
        repository.updatePasswordAndRevokeSessions(userId, 'new-hash'),
      ).rejects.toThrow();

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.password).toBe('old-hash');
      expect(await sessionsOf(userId)).toBe(2);
    });
  });

  describe('updateProfile', () => {
    it('should update the name and return the user without the hash', async () => {
      const userId = await createUser('me@example.com', 0);

      const user = await repository.updateProfile(userId, { fullName: 'New Name' });

      expect(user.fullName).toBe('New Name');
      expect(user).not.toHaveProperty('password');
    });

    it('should not update a soft-deleted user', async () => {
      const userId = await createUser('me@example.com', 0);
      await softDelete(userId);

      await expect(repository.updateProfile(userId, { fullName: 'New Name' })).rejects.toThrow();
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.fullName).toBe('Old Name');
    });
  });

  describe('findCredentialsById', () => {
    it('should return the hash of an existing user', async () => {
      const userId = await createUser('me@example.com', 0);

      expect(await repository.findCredentialsById(userId)).toMatchObject({
        id: userId,
        password: 'old-hash',
      });
    });

    it('should return null for a soft-deleted user', async () => {
      const userId = await createUser('me@example.com', 0);
      await softDelete(userId);

      expect(await repository.findCredentialsById(userId)).toBeNull();
    });
  });
});
