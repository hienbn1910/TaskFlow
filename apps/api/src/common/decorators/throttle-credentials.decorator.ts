import { SetMetadata } from '@nestjs/common';

export const THROTTLE_CREDENTIALS_KEY = 'throttle:credentials';

/**
 * Turns on the `credentials` throttler (5 attempts / min per IP + email, ADR-0031) for a route
 * whose body carries an email and a password. Off everywhere else: AppThrottlerGuard skips it.
 */
export const ThrottleCredentials = (): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_CREDENTIALS_KEY, true);
