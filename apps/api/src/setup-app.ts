import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { appConfig } from '@config/index';

export const API_PREFIX = 'api/v1';

/**
 * HTTP setup shared by main.ts AND the E2E tests, so tests run against
 * exactly the same configuration as production.
 */
export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.frontendUrl, credentials: true });
  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication): void {
  const document = new DocumentBuilder()
    .setTitle('TaskFlow API')
    .setDescription('Multi-tenant workspace collaboration platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('refresh_token')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, document)),
  );
}
