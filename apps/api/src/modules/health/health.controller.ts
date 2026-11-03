import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { Public } from '@common/decorators/public.decorator';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
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
