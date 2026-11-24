import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { appConfig } from '@config/index';

import { buildOpenApiDocument } from './openapi/openapi-document';

export const API_PREFIX = 'api/v1';

/** The trust proxy setting needs the Express instance, which Nest types as `any`. */
function isExpressApp(value: unknown): value is Pick<Express, 'set'> {
  return typeof value === 'function' && 'set' in value && typeof value.set === 'function';
}

/**
 * Every response is private and fresh: no proxy (Vercel) or browser cache keeps User data
 * (ADR-0019). Registered before every route, so errors and unknown routes get it too.
 */
function noStore(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * HTTP setup shared by main.ts AND the E2E tests, so tests run against
 * exactly the same configuration as production.
 */
export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Nest's own logs (and the exception filter's) go through pino, with the request id attached
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX);
  // req.ip = the client's address behind N proxies (Vercel → Render), used by rate limiting and
  // logs. 0 = trust none: X-Forwarded-For is ignored (ADR-0020)
  if (config.trustProxy > 0) {
    const server: unknown = app.getHttpAdapter().getInstance(); // typed `any` by Nest
    if (!isExpressApp(server)) throw new Error('trust proxy needs the Express adapter');
    server.set('trust proxy', config.trustProxy);
  }
  app.use(noStore);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.frontendUrl, credentials: true });
  app.enableShutdownHooks();
}

/** Swagger UI serves the same document as the committed openapi.json. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
}
