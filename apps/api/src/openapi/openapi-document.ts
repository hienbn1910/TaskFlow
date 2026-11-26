import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  type SchemaObject,
  SwaggerModule,
} from '@nestjs/swagger';
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
  return restorePatternTypes(cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
}

/**
 * Zod writes a string with several `.regex()` as `{ type: 'string', minLength, allOf: [{ pattern }…] }`.
 * Two tools break it (ADR-0033):
 * - @nestjs/swagger deletes `type` from any property with `allOf` (schema-object-factory), so the
 *   client got `unknown`. A `pattern` only constrains strings: the type is put back.
 * - orval then emits `string().regex().and(string().regex()).min()`, and an intersection has no
 *   `.min()`. Moving the length limits into `allOf` keeps every rule and gives valid code.
 * Guarded by the contract test that compares every DTO property type with Zod's own JSON schema.
 */
export function restorePatternTypes(document: OpenAPIObject): OpenAPIObject {
  for (const schema of Object.values(document.components?.schemas ?? {})) {
    if (!('properties' in schema)) continue;
    for (const property of Object.values(schema.properties ?? {})) {
      if (!('$ref' in property) && isTypelessPatternList(property)) restoreStringType(property);
    }
  }
  return document;
}

function isTypelessPatternList(property: SchemaObject): boolean {
  if (property.type !== undefined || property.allOf === undefined) return false;
  return property.allOf.every((part) => 'pattern' in part && !('type' in part));
}

function restoreStringType(property: SchemaObject): void {
  const { minLength, maxLength, allOf = [] } = property;
  const lengths = [{ minLength }, { maxLength }].filter(
    (limit) => Object.values(limit)[0] !== undefined,
  );
  delete property.minLength;
  delete property.maxLength;
  Object.assign(property, { type: 'string', allOf: [...lengths, ...allOf] });
}

/**
 * Stable text for the committed file: same document → same bytes, so PR diffs show only real
 * contract changes. Key order is Nest's (module and route order), which is deterministic.
 */
export function serializeOpenApi(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
