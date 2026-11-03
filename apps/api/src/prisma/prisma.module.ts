import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** @Global so each feature module doesn't have to import it — one connection pool for the whole app. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
