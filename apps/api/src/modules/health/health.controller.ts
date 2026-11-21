import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';

import { Public } from '@common/decorators/public.decorator';
import { SKIP_ALL_THROTTLERS } from '@common/throttling/throttle.constants';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
// Never rate limited: Render's health check calls it often from one IP, and a 429 there would
// get the service restarted (spec §6.2)
@SkipThrottle(SKIP_ALL_THROTTLERS)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Used by Render.com health checks and the keep-alive ping (WORKFLOW.md §8). */
  @Public()
  @Get()
  @ZodResponse({ type: HealthResponseDto, description: 'Service is up' })
  check(): HealthResponseDto {
    return this.healthService.check();
  }
}
