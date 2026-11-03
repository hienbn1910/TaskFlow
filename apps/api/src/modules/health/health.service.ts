import { Injectable } from '@nestjs/common';

import type { HealthResponse } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
