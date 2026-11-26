import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { z } from 'zod';

import { userResponseSchema } from '@common/types/user-response.dto';
import { authResponseSchema } from '@modules/auth/dto/auth-response.dto';
import { loginSchema } from '@modules/auth/dto/login.dto';
import { registerSchema } from '@modules/auth/dto/register.dto';
import { healthResponseSchema } from '@modules/health/dto/health-response.dto';
import { readinessResponseSchema } from '@modules/health/dto/readiness-response.dto';
import { changePasswordSchema } from '@modules/users/dto/change-password.dto';
import { updateProfileSchema } from '@modules/users/dto/update-profile.dto';

import { buildOpenApiDocument, OPENAPI_FILE } from '../src/openapi/openapi-document';
import { createTestApp } from './utils/auth-helpers';

const OUT_OF_DATE = 'openapi.json is out of date: run `pnpm --filter api openapi:export`';

/** Every Zod DTO: its component name in the document, its schema, and the side it describes. */
const DTO_SCHEMAS: [string, z.ZodType, 'input' | 'output'][] = [
  ['HealthResponseDto_Output', healthResponseSchema, 'output'],
  ['ReadinessResponseDto_Output', readinessResponseSchema, 'output'],
  ['AuthResponseDto_Output', authResponseSchema, 'output'],
  ['UserResponseDto_Output', userResponseSchema, 'output'],
  ['RegisterDto', registerSchema, 'input'],
  ['LoginDto', loginSchema, 'input'],
  ['UpdateProfileDto', updateProfileSchema, 'input'],
  ['ChangePasswordDto', changePasswordSchema, 'input'],
];

/**
 * The committed openapi.json is the frontend's contract (ADR-0033): the generated client is
 * built from it. This fails when an endpoint, DTO or Swagger text changed without re-exporting.
 * Compared as parsed JSON, so a CRLF checkout on Windows does not count as a change.
 */
describe('OpenAPI contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should match the committed openapi.json', () => {
    const assertUpToDate = (): void => {
      if (!existsSync(OPENAPI_FILE)) throw new Error(OUT_OF_DATE);
      const committed: unknown = JSON.parse(readFileSync(OPENAPI_FILE, 'utf8'));
      // Round trip: drops `undefined` values exactly like the export does
      const built: unknown = JSON.parse(JSON.stringify(buildOpenApiDocument(app)));
      if (!isDeepStrictEqual(committed, built)) throw new Error(OUT_OF_DATE);
    };

    expect(assertUpToDate).not.toThrow();
  });

  // Zod 4 writes nullable fields as `type: ['string', 'null']`, which only OpenAPI 3.1 allows.
  // A 3.0 document with that syntax is rejected by strict tools such as orval (ADR-0033).
  it('should declare OpenAPI 3.1 when a schema uses a type list', () => {
    const document = buildOpenApiDocument(app);

    expect(hasTypeList(document)).toBe(true);
    expect(document.openapi).toMatch(/^3\.1\./);
  });

  // @nestjs/swagger reads a top-level `type` list as "array of": a nullable string
  // (`['string', 'null']`) became `type: 'array'` in the contract, and `string[]` in the client
  it.each(DTO_SCHEMAS)('should keep the Zod property types of %s', (name, schema, io) => {
    const component = buildOpenApiDocument(app).components?.schemas?.[name];

    expect(propertyTypes(component)).toEqual(propertyTypes(z.toJSONSchema(schema, { io })));
  });
});

/** `{ property: type }` of a JSON schema object (`type` may be absent, a string or a list). */
function propertyTypes(schema: unknown): Record<string, unknown> {
  const parsed = z
    .object({ properties: z.record(z.string(), z.object({ type: z.unknown().optional() })) })
    .parse(schema);
  return Object.fromEntries(
    Object.entries(parsed.properties).map(([key, value]) => [key, value.type]),
  );
}

/** True when any `type` in the document is an array (OpenAPI 3.1 syntax). */
function hasTypeList(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTypeList);
  if (typeof node !== 'object' || node === null) return false;
  return Object.entries(node).some(
    ([key, value]) => (key === 'type' && Array.isArray(value)) || hasTypeList(value),
  );
}
