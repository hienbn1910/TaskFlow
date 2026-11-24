import type { ThrottlerModuleOptions } from '@nestjs/throttler';

import { DEFAULT_LIMITS, THROTTLER, TOO_MANY_REQUESTS_MESSAGE } from './throttle.constants';

/**
 * Named throttlers (plan §3.1). Which one applies to a request, and its key, is decided by
 * AppThrottlerGuard. `setHeaders: false`: the guard sends one plain `Retry-After` on a 429
 * instead of the per-throttler `X-RateLimit-*-<name>` / `Retry-After-<name>` headers.
 * Default storage: in memory (one instance, ADR-0018; no Redis commands).
 */
export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: Object.values(THROTTLER).map((name) => ({
    name,
    ...DEFAULT_LIMITS[name],
  })),
  errorMessage: TOO_MANY_REQUESTS_MESSAGE,
  setHeaders: false,
};
