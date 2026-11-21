import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  AUTH_URL,
  bodyOf,
  createTestApp,
  errorBodySchema,
  PASSWORD,
  registerUser,
} from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';
import { resetThrottler } from './utils/throttler';

const WRONG_PASSWORD = 'Wrong123';

/**
 * Rate limits of ADR-0031 (spec §6), against the real app: in-memory throttler, real guards.
 * Limits are literals from the spec, never read from the constants file.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    resetThrottler(app);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  const loginAs = (email: string, forwardedFor?: string) => {
    const req = request(app.getHttpServer()).post(`${AUTH_URL}/login`);
    if (forwardedFor !== undefined) req.set('X-Forwarded-For', forwardedFor);
    return req.send({ email, password: WRONG_PASSWORD });
  };

  /** Sends `count` requests one after the other and returns their statuses. */
  const statusesOf = async (count: number, send: (i: number) => request.Test) => {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) statuses.push((await send(i)).status);
    return statuses;
  };

  describe('POST /auth/login: 5 / min per IP + email', () => {
    it('should return 429 with Retry-After and the standard body on the 6th attempt', async () => {
      expect(await statusesOf(5, () => loginAs('hien@example.com'))).toEqual([
        401, 401, 401, 401, 401,
      ]);

      const res = await loginAs('hien@example.com');

      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
      expect(bodyOf(res, errorBodySchema)).toEqual({
        success: false,
        statusCode: 429,
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        timestamp: expect.any(String),
        requestId: res.headers['x-request-id'],
      });
    });

    it('should count the same email written with other case or spaces against one limit', async () => {
      const variants = [
        'Hien@Example.com',
        ' hien@example.com',
        'HIEN@EXAMPLE.COM',
        'hien@example.com ',
      ];
      await statusesOf(5, (i) => loginAs(variants[i % variants.length] ?? 'hien@example.com'));

      expect((await loginAs('hien@EXAMPLE.com')).status).toBe(429);
    });

    it('should keep a separate counter for another email from the same IP', async () => {
      await statusesOf(5, () => loginAs('hien@example.com'));

      expect((await loginAs('other@example.com')).status).toBe(401);
    });

    // Bad body: no per-email key, but the per-IP limit (20 / min) still counts it
    it('should not crash the limiter on a body without email', async () => {
      const res = await request(app.getHttpServer()).post(`${AUTH_URL}/login`).send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login: 20 / min per IP', () => {
    it('should return 429 on the 21st attempt from one IP, whatever the email', async () => {
      await statusesOf(20, (i) => loginAs(`user${String(i)}@example.com`));

      expect((await loginAs('fresh@example.com')).status).toBe(429);
    });
  });

  describe('POST /auth/register: 5 / hour per IP', () => {
    it('should return 429 on the 6th registration from one IP', async () => {
      const register = (i: number) =>
        request(app.getHttpServer())
          .post(`${AUTH_URL}/register`)
          .send({ email: `user${String(i)}@example.com`, password: PASSWORD, fullName: 'Hien' });

      expect(await statusesOf(5, register)).toEqual([201, 201, 201, 201, 201]);

      const res = await register(5);
      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(60);
    });
  });

  describe('PATCH /users/password: 5 / 15 min per User', () => {
    const changePassword = (accessToken: string) =>
      request(app.getHttpServer())
        .patch('/api/v1/users/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: WRONG_PASSWORD, newPassword: 'NewSecret456' });

    // Passing proves the guard order too: the key is the User, known only after JwtAuthGuard
    it('should return 429 on the 6th attempt of one User, not for another User', async () => {
      const hien = await registerUser(app, 'hien@example.com');
      const other = await registerUser(app, 'other@example.com');

      expect(await statusesOf(5, () => changePassword(hien.accessToken))).toEqual([
        400, 400, 400, 400, 400,
      ]);

      const res = await changePassword(hien.accessToken);
      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(60);
      expect((await changePassword(other.accessToken)).status).toBe(400);
    });
  });

  describe('Authenticated routes: 120 / min per User', () => {
    // 61+ requests: an authenticated User is not held to the anonymous 60 / min per IP
    it('should allow 120 requests of one User per minute and return 429 on the 121st', async () => {
      const { accessToken } = await registerUser(app);
      const getMe = () =>
        request(app.getHttpServer())
          .get(`${AUTH_URL}/me`)
          .set('Authorization', `Bearer ${accessToken}`);

      const statuses = await statusesOf(120, getMe);

      expect(statuses.filter((status) => status !== 200)).toEqual([]);
      expect((await getMe()).status).toBe(429);
    });
  });

  describe('GET /health', () => {
    // Render's health check calls it often from one IP: a 429 would get the service restarted
    it('should never be rate limited', async () => {
      const statuses = await statusesOf(70, () =>
        request(app.getHttpServer()).get('/api/v1/health'),
      );

      expect(statuses.filter((status) => status !== 200)).toEqual([]);
    });
  });

  // ADR-0020: with TRUST_PROXY=0 the client's X-Forwarded-For is ignored, so it cannot fake an IP
  describe('IP behind proxies', () => {
    it('should ignore a changing X-Forwarded-For when TRUST_PROXY=0', async () => {
      await statusesOf(5, (i) => loginAs('hien@example.com', `198.51.100.${String(i)}`));

      expect((await loginAs('hien@example.com', '198.51.100.99')).status).toBe(429);
    });

    describe('with TRUST_PROXY=1 (one proxy in front of the API)', () => {
      let proxied: INestApplication<App>;

      beforeAll(async () => {
        process.env['TRUST_PROXY'] = '1';
        proxied = await createTestApp();
        process.env['TRUST_PROXY'] = '0';
      });

      afterAll(async () => {
        await proxied.close();
      });

      const loginBehindProxy = (clientIp: string) =>
        request(proxied.getHttpServer())
          .post(`${AUTH_URL}/login`)
          .set('X-Forwarded-For', clientIp)
          .send({ email: 'hien@example.com', password: WRONG_PASSWORD });

      it('should give each client address its own counter', async () => {
        resetThrottler(proxied);
        await statusesOf(5, () => loginBehindProxy('203.0.113.1'));

        expect((await loginBehindProxy('203.0.113.2')).status).toBe(401);
        expect((await loginBehindProxy('203.0.113.1')).status).toBe(429);
      });
    });
  });
});
