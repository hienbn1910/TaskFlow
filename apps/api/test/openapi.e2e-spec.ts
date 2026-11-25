import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { buildOpenApiDocument, OPENAPI_FILE } from '../src/openapi/openapi-document';
import { createTestApp } from './utils/auth-helpers';

const OUT_OF_DATE = 'openapi.json is out of date: run `pnpm --filter api openapi:export`';

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
});

/** True when any `type` in the document is an array (OpenAPI 3.1 syntax). */
function hasTypeList(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTypeList);
  if (typeof node !== 'object' || node === null) return false;
  return Object.entries(node).some(
    ([key, value]) => (key === 'type' && Array.isArray(value)) || hasTypeList(value),
  );
}
