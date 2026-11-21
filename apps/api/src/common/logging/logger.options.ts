import type { ConfigType } from '@nestjs/config';
import type { IncomingMessage } from 'node:http';
import type { LevelWithSilent } from 'pino';
import type { Options } from 'pino-http';

import type { appConfig } from '@config/app.config';

import { generateRequestId } from './request-id';

type LoggerConfig = Pick<ConfigType<typeof appConfig>, 'nodeEnv' | 'logLevel'>;

const DEFAULT_LEVEL: Readonly<Record<LoggerConfig['nodeEnv'], LevelWithSilent>> = {
  production: 'info',
  development: 'debug',
  test: 'silent',
};

/**
 * Values that never reach the logs (RULE.md §5): credentials in headers, the refresh cookie in
 * both directions, and password fields of any logged object (`*.x` = one level deep, e.g. `body`).
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
];

/**
 * pino-http options (ADR-0035, spec §7.1): one JSON line per request with method, url, status,
 * responseTime, request id and User id. Pretty-printed in development only; `LOG_LEVEL` overrides
 * the level of the environment.
 */
export function buildLoggerOptions(config: LoggerConfig): Options {
  const isDevelopment = config.nodeEnv === 'development';
  return {
    level: config.logLevel ?? DEFAULT_LEVEL[config.nodeEnv],
    genReqId: generateRequestId,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    // Called again when the response finishes, so the User set by JwtAuthGuard is included
    customProps: (request) => {
      const userId = userIdOf(request);
      return userId === undefined ? {} : { userId };
    },
    ...(isDevelopment
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  };
}

/** `request.user.id` set by JwtAuthGuard; pino-http types the request as a plain IncomingMessage. */
function userIdOf(request: IncomingMessage): string | undefined {
  const user: unknown = 'user' in request ? request.user : undefined;
  if (typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'string') {
    return user.id;
  }
  return undefined;
}
