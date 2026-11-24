import { Injectable, Logger } from '@nestjs/common';

import { withTimeout } from '@common/utils/with-timeout.util';

import type { ReadinessResponse } from './dto/readiness-response.dto';
import { ServiceNotReadyException } from './exceptions/service-not-ready.exception';
import { HealthRepository } from './health.repository';

/** A hanging dependency answers "down" after this, so readiness never hangs (spec §7.4). */
const CHECK_TIMEOUT_MS = 3000;

type CheckName = keyof ReadinessResponse['checks'];

/** The only reason a client sees: causes and hosts stay in the log (readiness is public). */
const UNREACHABLE = 'unreachable';

/**
 * Readiness: can this instance serve traffic? Kept apart from HealthService on purpose:
 * liveness (`/health`) has no dependency at all, so it can never touch the database (ADR-0019).
 */
@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(private readonly healthRepository: HealthRepository) {}

  async check(): Promise<ReadinessResponse> {
    // In parallel: the slowest check bounds the answer, not their sum
    const results = await Promise.all([
      this.isUp('database', async () => this.healthRepository.pingDatabase()),
      this.isUp('redis', async () => this.healthRepository.pingRedis()),
    ]);
    const down = results.filter((result) => !result.up);
    if (down.length > 0) {
      throw new ServiceNotReadyException(
        down.map(({ name }) => ({ field: name, message: UNREACHABLE })),
      );
    }
    return { status: 'ok', checks: { database: 'up', redis: 'up' } };
  }

  /** Never throws: the reason goes to the log only, the client sees UNREACHABLE. */
  private async isUp(
    name: CheckName,
    ping: () => Promise<void>,
  ): Promise<{ name: CheckName; up: boolean }> {
    try {
      await withTimeout(ping(), CHECK_TIMEOUT_MS);
      return { name, up: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Readiness check "${name}" failed: ${reason}`);
      return { name, up: false };
    }
  }
}
