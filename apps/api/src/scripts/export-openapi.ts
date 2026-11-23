import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { buildOpenApiDocument, OPENAPI_FILE, serializeOpenApi } from '../openapi/openapi-document';
import { setupApp } from '../setup-app';

/**
 * `pnpm --filter api openapi:export`: writes apps/api/openapi.json (ADR-0033).
 * No `app.init()`: lifecycle hooks never run, so no database or Redis connection is opened.
 * The env must still be valid (config is validated when the module is built).
 */
async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  setupApp(app); // global prefix: paths are /api/v1/...
  writeFileSync(OPENAPI_FILE, serializeOpenApi(buildOpenApiDocument(app)));
  await app.close();
  process.stdout.write(`Wrote ${OPENAPI_FILE}\n`);
}

void exportOpenApi();
