import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { sha256Hex } from '@common/utils/hash.util';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  AUTH_URL,
  authBodySchema,
  bodyOf,
  createTestApp,
  errorBodySchema,
  login,
  me,
  PASSWORD,
  refresh,
  refreshCookiePair,
  refreshSetCookie,
  registerUser,
  tokenOf,
  userBodySchema,
} from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';

/**
 * Integration tests against the real test database (postgres-test, port 5433).
 * One test per acceptance criterion of docs/specs/auth.md §6.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  const post = (path: string) => request(app.getHttpServer()).post(`${AUTH_URL}/${path}`);

  describe('POST /auth/register', () => {
    const body = { email: 'hien@example.com', password: PASSWORD, fullName: 'Hien Nguyen' };

    it('should return 201 with accessToken + user, and the refresh token only in the cookie', async () => {
      const res = await post('register').send(body).expect(201);

      expect(bodyOf(res, authBodySchema)).toEqual({
        success: true,
        data: {
          accessToken: expect.any(String),
          user: {
            id: expect.any(String),
            email: 'hien@example.com',
            fullName: 'Hien Nguyen',
            avatarUrl: null,
            createdAt: expect.any(String),
          },
        },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/refreshToken|password/);
      const cookie = refreshSetCookie(res);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=604800');
    });

    it('should store a bcrypt hash and a sha256 of the refresh token, never raw values', async () => {
      const res = await post('register').send(body).expect(201);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
      expect(user.password).toMatch(/^\$2[aby]\$10\$/);
      expect(user.password).not.toContain(PASSWORD);
      const sessions = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.tokenHash).toBe(sha256Hex(tokenOf(refreshCookiePair(res))));
    });

    it('should treat emails case-insensitively', async () => {
      await post('register').send({ ...body, email: '  Hien@Example.COM ' }).expect(201);

      await post('register').send(body).expect(409);
      expect((await login(app, 'hien@example.com')).status).toBe(200);
    });

    it('should return 409 for a duplicate email', async () => {
      await post('register').send(body).expect(201);

      const res = await post('register').send(body).expect(409);

      expect(bodyOf(res, errorBodySchema).message).toBe(AUTH_ERROR.EMAIL_ALREADY_REGISTERED);
    });

    it('should return 409 for the email of a soft-deleted user', async () => {
      await post('register').send(body).expect(201);
      await prisma.user.update({ where: { email: body.email }, data: { deletedAt: new Date() } });

      const res = await post('register').send(body).expect(409);

      expect(bodyOf(res, errorBodySchema).message).toBe(AUTH_ERROR.EMAIL_ALREADY_REGISTERED);
    });

    it('should return 400 with field details for a weak password', async () => {
      const res = await post('register').send({ ...body, password: 'weak' }).expect(400);

      expect(bodyOf(res, errorBodySchema).details?.map((d) => d.field)).toContain('password');
    });

    it('should store fullName without HTML tags', async () => {
      await post('register').send({ ...body, fullName: '<b>Hien</b>' }).expect(201);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
      expect(user.fullName).toBe('Hien');
    });
  });

  describe('POST /auth/login', () => {
    it('should log in, set the cookie and update lastLoginAt', async () => {
      const { email } = await registerUser(app);

      const res = await login(app, email);

      expect(res.status).toBe(200);
      expect(refreshSetCookie(res)).toBeDefined();
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should return the IDENTICAL 401 for every failure case', async () => {
      await registerUser(app, 'active@example.com');
      await registerUser(app, 'inactive@example.com');
      await registerUser(app, 'deleted@example.com');
      await prisma.user.update({
        where: { email: 'inactive@example.com' },
        data: { isActive: false },
      });
      await prisma.user.update({
        where: { email: 'deleted@example.com' },
        data: { deletedAt: new Date() },
      });

      const responses = await Promise.all([
        post('login').send({ email: 'active@example.com', password: 'Wrong123' }),
        post('login').send({ email: 'nobody@example.com', password: PASSWORD }),
        post('login').send({ email: 'inactive@example.com', password: PASSWORD }),
        post('login').send({ email: 'deleted@example.com', password: PASSWORD }),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(bodyOf(res, errorBodySchema)).toEqual({
          success: false,
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: AUTH_ERROR.INVALID_CREDENTIALS,
          timestamp: expect.any(String),
        });
        expect(refreshSetCookie(res)).toBeUndefined();
      }
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate: new access token, new cookie, old session gone', async () => {
      const { cookie, userId } = await registerUser(app);

      const res = await refresh(app, cookie);

      expect(res.status).toBe(200);
      const newCookie = refreshCookiePair(res);
      expect(newCookie).not.toBe(cookie);
      const sessions = await prisma.refreshToken.findMany({ where: { userId } });
      expect(sessions.map((s) => s.tokenHash)).toEqual([sha256Hex(tokenOf(newCookie))]);
    });

    it('should revoke ALL sessions of the user when a rotated token is reused', async () => {
      const { email, cookie: firstCookie, userId } = await registerUser(app);
      const otherDevice = refreshCookiePair(await login(app, email));
      expect((await refresh(app, firstCookie)).status).toBe(200);

      const reuse = await refresh(app, firstCookie);

      expect(reuse.status).toBe(401);
      expect(bodyOf(reuse, errorBodySchema).message).toBe(AUTH_ERROR.INVALID_REFRESH_TOKEN);
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);
      expect((await refresh(app, otherDevice)).status).toBe(401);
    });

    // End-to-end behavior only. This test also passes with a non-atomic rotate, because the
    // work before rotate (verify, load user, sign) keeps the two requests from overlapping.
    // The race itself is proven by test/refresh-token.repository.e2e-spec.ts.
    it('should let exactly ONE of two parallel requests with the same cookie succeed', async () => {
      const { cookie } = await registerUser(app);

      const statuses = (await Promise.all([refresh(app, cookie), refresh(app, cookie)]))
        .map((res) => res.status)
        .sort();

      expect(statuses).toEqual([200, 401]);
    });

    it('should clear the cookie when refresh fails', async () => {
      const res = await refresh(app, 'refresh_token=garbage');

      expect(res.status).toBe(401);
      expect(refreshSetCookie(res)).toMatch(/^refresh_token=;.*Expires=Thu, 01 Jan 1970/);
    });

    it.each([
      ['no cookie', undefined],
      ['a garbage cookie', 'refresh_token=not-a-jwt'],
    ])('should return 401 with %s', async (_, cookie) => {
      expect((await refresh(app, cookie)).status).toBe(401);
    });

    it('should reject an ACCESS token sent as the refresh cookie', async () => {
      const { accessToken } = await registerUser(app);

      expect((await refresh(app, `refresh_token=${accessToken}`)).status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should delete the session and clear the cookie; the old cookie no longer refreshes', async () => {
      const { cookie, userId } = await registerUser(app);

      const res = await post('logout').set('Cookie', cookie).expect(200);

      expect(res.body).toEqual({ success: true, data: null });
      expect(refreshSetCookie(res)).toMatch(/^refresh_token=;/);
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);
      expect((await refresh(app, cookie)).status).toBe(401);
    });

    it('should be idempotent: no cookie, or called twice, still 200', async () => {
      const { cookie } = await registerUser(app);

      await post('logout').expect(200);
      await post('logout').set('Cookie', cookie).expect(200);
      await post('logout').set('Cookie', cookie).expect(200);
    });
  });

  describe('GET /auth/me and the global guard', () => {
    it('should return the current user for a valid access token', async () => {
      const { accessToken, email } = await registerUser(app);

      const res = await me(app, accessToken);

      expect(res.status).toBe(200);
      expect(bodyOf(res, userBodySchema).data.email).toBe(email);
    });

    it('should reject a missing, garbage, or REFRESH token with 401', async () => {
      const { cookie } = await registerUser(app);

      expect((await me(app)).status).toBe(401);
      expect((await me(app, 'garbage')).status).toBe(401);
      expect((await me(app, tokenOf(cookie))).status).toBe(401);
    });

    it('should lock out a user deactivated AFTER login, without waiting for token expiry', async () => {
      const { accessToken, userId } = await registerUser(app);
      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

      expect((await me(app, accessToken)).status).toBe(401);
    });

    it('should keep /health public', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });
});
