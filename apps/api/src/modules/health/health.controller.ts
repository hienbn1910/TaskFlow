import { Controller, Get } from '@nestjs/common';
import { ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';

import { Public } from '@common/decorators/public.decorator';
import { SKIP_ALL_THROTTLERS } from '@common/throttling/throttle.constants';

import { HealthResponseDto } from './dto/health-response.dto';
import { ReadinessResponseDto } from './dto/readiness-response.dto';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

@ApiTags('Health')
// Never rate limited: Render's health check calls it often from one IP, and a 429 there would
// get the service restarted (spec §6.2)
@SkipThrottle(SKIP_ALL_THROTTLERS)
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly readinessService: ReadinessService,
  ) {}

  /** Liveness: used by Render.com health checks and the keep-alive ping (WORKFLOW.md §8). */
  @Public()
  @Get()
  @ZodResponse({ type: HealthResponseDto, description: 'Service is up' })
  check(): HealthResponseDto {
    return this.healthService.check();
  }

  /**
   * Readiness: database and Redis reachable. Called after a deploy and by hand only, never by
   * a frequent pinger: it wakes Neon (WORKFLOW.md §3).
   */
  @Public()
  @Get('ready')
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  @ZodResponse({ type: ReadinessResponseDto, description: 'Database and Redis reachable' })
  async ready(): Promise<ReadinessResponseDto> {
    return this.readinessService.check();
  }
}
