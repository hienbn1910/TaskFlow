import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { NewRefreshToken } from './entities/refresh-token.entity';

/**
 * Data access for `refresh_tokens`: one row = one session.
 * Every lookup is by `tokenHash` (unique index) or `userId` (index): both already in the schema.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewRefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({ data, select: { id: true } });
  }

  /**
   * Atomically replaces the session `oldHash` with `next`.
   * Returns false, writing nothing, when `oldHash` no longer exists (already rotated or logged out).
   *
   * Why deleteMany + count instead of find-then-delete: if two requests send the same token at
   * the same time, PostgreSQL row locking lets only ONE delete succeed (count 1); the other
   * waits, then sees the row gone (count 0). With find-then-delete both could pass the find.
   * The `count === 0` check is the atomicity condition of this query, not a business rule:
   * what to do about it (revoke every session) is decided by AuthService.
   */
  async rotate(oldHash: string, next: NewRefreshToken): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.deleteMany({ where: { tokenHash: oldHash } });
      if (count === 0) {
        return false;
      }
      await tx.refreshToken.create({ data: next, select: { id: true } });
      return true;
    });
  }

  /** Logout. A missing row is not an error (logout is idempotent). */
  async deleteByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  /** Ends every session of a user (refresh token reuse detected). */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
