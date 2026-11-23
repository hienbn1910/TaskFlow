import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';

import { createRedisClient } from '../src/redis/redis.module';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { bodyOf, createTestApp, errorBodySchema } from './utils/auth-helpers';

const READY_URL = '/api/v1/health/ready';
// Nothing listens on port 1: the connection is refused at once, the real reason Redis is "down"
const DEAD_REDIS_URL = 'redis://127.0.0.1:1';
const TIMEOUT_MS = 3000;

const readyBodySchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal('ok'),
    checks: z.object({ database: z.string(), redis: z.string() }),
  }),
});

/** Readiness (spec §7.4, ADR-0035): checks the database and Redis, unlike liveness `/health`. */
describe('Health readiness (e2e)', () => {
  describe('when the database and Redis are reachable', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 200 with both checks up', async () => {
      const res = await request(app.getHttpServer()).get(READY_URL).expect(200);

      expect(bodyOf(res, readyBodySchema).data).toEqual({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
      });
    });
  });

  describe('when Redis refuses connections', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      // The same client factory as production, pointed at a dead port: not a mock
      const deadRedis = createRedisClient({ url: DEAD_REDIS_URL });
      app = await createTestApp([{ token: REDIS_CLIENT, value: deadRedis }]);
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 503 with a redis detail, within the timeout', async () => {
      const startedAt = Date.now();
      const res = await request(app.getHttpServer()).get(READY_URL).expect(503);

      expect(Date.now() - startedAt).toBeLessThan(TIMEOUT_MS);
      const body = bodyOf(res, errorBodySchema);
      expect(body.message).toBe('Service not ready');
      expect(body.details).toEqual([{ field: 'redis', message: 'unreachable' }]);
    });

    it('should keep liveness at 200: /health never depends on Redis or the database', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });
});
