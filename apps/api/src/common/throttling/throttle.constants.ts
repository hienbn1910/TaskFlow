/**
 * Rate limits of milestone 2 (ADR-0031, spec §6.1), in one place. `ttl` is the window in
 * milliseconds (@nestjs/throttler v6). Counters live in memory: one instance (ADR-0018).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Named throttlers. Each has its own key and its own counters (plan §3.1). */
export const THROTTLER = {
  /** Requests without a User, keyed by IP. */
  ANONYMOUS: 'anonymous',
  /** Requests with a User (after JwtAuthGuard), keyed by User id. */
  USER: 'user',
  /** Login only, keyed by IP + normalized email. */
  CREDENTIALS: 'credentials',
} as const;

export interface ThrottleLimit {
  readonly limit: number;
  readonly ttl: number;
}

/** Defaults of the named throttlers: apply to every route unless overridden. */
export const DEFAULT_LIMITS = {
  [THROTTLER.ANONYMOUS]: { limit: 60, ttl: MINUTE_MS },
  [THROTTLER.USER]: { limit: 120, ttl: MINUTE_MS },
  [THROTTLER.CREDENTIALS]: { limit: 5, ttl: MINUTE_MS },
} as const satisfies Record<string, ThrottleLimit>;

/** Route overrides (`@Throttle`). */
export const ROUTE_LIMITS = {
  LOGIN_PER_IP: { limit: 20, ttl: MINUTE_MS },
  REGISTER_PER_IP: { limit: 5, ttl: HOUR_MS },
  REFRESH_PER_IP: { limit: 30, ttl: MINUTE_MS },
  CHANGE_PASSWORD_PER_USER: { limit: 5, ttl: 15 * MINUTE_MS },
} as const satisfies Record<string, ThrottleLimit>;

export const TOO_MANY_REQUESTS_MESSAGE = 'Too many requests';

/**
 * For `@SkipThrottle(SKIP_ALL_THROTTLERS)`. A bare `@SkipThrottle()` only skips a throttler
 * named "default", which this app does not have: every named throttler must be listed.
 */
export const SKIP_ALL_THROTTLERS = {
  [THROTTLER.ANONYMOUS]: true,
  [THROTTLER.USER]: true,
  [THROTTLER.CREDENTIALS]: true,
} as const satisfies Record<(typeof THROTTLER)[keyof typeof THROTTLER], true>;
