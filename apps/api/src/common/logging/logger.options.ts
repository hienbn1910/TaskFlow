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
 * pino-http options (ADR-0035, spec §7.1): one JSON line per request with method, url, route,
 * status, responseTime, request id and User id. Pretty-printed in development only; `LOG_LEVEL` overrides
 * the level of the environment.
 */
export function buildLoggerOptions(config: LoggerConfig): Options {
  const isDevelopment = config.nodeEnv === 'development';
  return {
    level: config.logLevel ?? DEFAULT_LEVEL[config.nodeEnv],
    genReqId: generateRequestId,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    // Called again when the response finishes, so the matched route and the User set by
    // JwtAuthGuard are both known by then
    customProps: (request) => {
      const route = routeOf(request);
      const userId = userIdOf(request);
      return {
        ...(route === undefined ? {} : { route }),
        ...(userId === undefined ? {} : { userId }),
      };
    },
    ...(isDevelopment
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  };
}

/**
 * Route template matched by Express (`/api/v1/users/:id`), not the URL: groups the lines of one
 * endpoint and keeps ids out of the field. An unknown URL logs Nest's not-found catch-all,
 * `/api/v1{/*splat}`, so every 404 groups under one route.
 */
function routeOf(request: IncomingMessage): string | undefined {
  const route: unknown = 'route' in request ? request.route : undefined;
  if (typeof route === 'object' && route !== null && 'path' in route) {
    return typeof route.path === 'string' ? route.path : undefined;
  }
  return undefined;
}

/** `request.user.id` set by JwtAuthGuard; pino-http types the request as a plain IncomingMessage. */
function userIdOf(request: IncomingMessage): string | undefined {
  const user: unknown = 'user' in request ? request.user : undefined;
  if (typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'string') {
    return user.id;
  }
  return undefined;
}
