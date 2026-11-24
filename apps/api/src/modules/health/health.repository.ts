import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';

/**
 * The two dependencies readiness checks. Each method resolves when reachable, rejects otherwise.
 * Redis is here too although RULE.md §3 keeps repositories for the database: a one-line PING
 * does not deserve its own class (decided in the branch review).
 */
@Injectable()
export class HealthRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async pingDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  /**
   * The client is created with `lazyConnect`, so the first check opens the connection. Without
   * this, `enableOfflineQueue: false` would reject the first PING before the socket is ready.
   */
  async pingRedis(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    await this.redis.ping();
  }
}
