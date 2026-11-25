import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';

/** `apps/api/openapi.json`: two levels up from both `src/openapi/` and `dist/openapi/`. */
export const OPENAPI_FILE = join(__dirname, '..', '..', 'openapi.json');

/**
 * The one OpenAPI document: served by Swagger UI, written by `openapi:export`, checked by the
 * contract test (ADR-0033). Needs the global prefix already set (setupApp), not `app.init()`.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    // 3.1: Zod 4 writes nullable fields as `type: [x, 'null']`, invalid in 3.0 (rejected by orval)
    .setOpenAPIVersion('3.1.0')
    .setTitle('TaskFlow API')
    .setDescription('Multi-tenant workspace collaboration platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME)
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

/**
 * Stable text for the committed file: same document → same bytes, so PR diffs show only real
 * contract changes. Key order is Nest's (module and route order), which is deterministic.
 */
export function serializeOpenApi(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
