import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, ReadinessService, HealthRepository],
})
export class HealthModule {}
