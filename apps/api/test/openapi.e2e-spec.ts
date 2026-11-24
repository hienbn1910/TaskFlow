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
});
