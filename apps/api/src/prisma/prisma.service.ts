import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { databaseConfig } from '@config/index';
import { PrismaClient } from '@prisma-client/client';

/**
 * The only place that creates a PrismaClient. Only repositories may inject this service
 * (RULE.md §3: services never touch Prisma directly).
 * Prisma 7 talks to PostgreSQL through a "driver adapter" (node-postgres) instead of a Rust engine.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(databaseConfig.KEY) config: ConfigType<typeof databaseConfig>) {
    super({ adapter: new PrismaPg({ connectionString: config.url }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
