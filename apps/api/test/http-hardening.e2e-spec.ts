import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AUTH_URL, bodyOf, createTestApp, errorBodySchema } from './utils/auth-helpers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INCOMING_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34';

/**
 * Behaviour every response shares, whatever the route (spec §5, §7.2).
 * No database rows are needed: the routes used here fail before touching any table.
 */
describe('HTTP hardening (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('X-Request-Id', () => {
    it('should send a UUID X-Request-Id on a successful response', async () => {
      const res = await request(server()).get('/api/v1/health').expect(200);

      expect(res.headers['x-request-id']).toMatch(UUID_PATTERN);
    });

    it('should echo an incoming UUID X-Request-Id', async () => {
      const res = await request(server()).get('/api/v1/health').set('X-Request-Id', INCOMING_ID);

      expect(res.headers['x-request-id']).toBe(INCOMING_ID);
    });

    it('should replace an incoming X-Request-Id that is not a UUID', async () => {
      const res = await request(server()).get('/api/v1/health').set('X-Request-Id', 'abc');

      expect(res.headers['x-request-id']).toMatch(UUID_PATTERN);
      expect(res.headers['x-request-id']).not.toBe('abc');
    });

    it('should put the same requestId in the error body as in the header', async () => {
      const res = await request(server()).get(`${AUTH_URL}/me`).expect(401);

      expect(bodyOf(res, errorBodySchema).requestId).toBe(res.headers['x-request-id']);
    });

    it('should keep an incoming UUID in the error body of an unknown route', async () => {
      const res = await request(server())
        .get('/api/v1/does-not-exist')
        .set('X-Request-Id', INCOMING_ID)
        .expect(404);

      expect(bodyOf(res, errorBodySchema).requestId).toBe(INCOMING_ID);
    });
  });
});
