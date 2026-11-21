import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { appConfig } from '@config/index';

import { AppModule } from './app.module';
import { setupApp, setupSwagger } from './setup-app';

async function bootstrap(): Promise<void> {
  // bufferLogs: startup logs wait until setupApp switches to pino, so they are JSON too
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  setupApp(app);
  setupSwagger(app);

  await app.listen(config.port);
  Logger.log(`API running on http://localhost:${String(config.port)}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${String(config.port)}/api/docs`, 'Bootstrap');
}

void bootstrap();
