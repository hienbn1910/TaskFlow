import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Empties the auth tables between tests. Refuses to run outside NODE_ENV=test, so a test
 * started with the wrong .env can never wipe the development database.
 * Order matters: refresh_tokens references users.
 */
export async function resetDb(prisma: PrismaService): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`resetDb refused: NODE_ENV is "${String(process.env.NODE_ENV)}", not "test"`);
  }
  await prisma.$transaction([prisma.refreshToken.deleteMany(), prisma.user.deleteMany()]);
}
