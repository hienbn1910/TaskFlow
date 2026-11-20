import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';

import { USER_ERROR } from '@common/constants/user.constant';
import { verifyPassword } from '@common/utils/password.util';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  AUTH_URL,
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
  userBodySchema,
} from './utils/auth-helpers';
import { resetDb } from './utils/reset-db';

const USERS_URL = '/api/v1/users';
const NEW_PASSWORD = 'NewSecret456';

/**
 * Integration tests against the real test database (postgres-test, port 5433).
 * One test per acceptance criterion of docs/specs/user-profile.md §4.
 */
describe('Users (e2e)', () => {
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

  const patch = async (path: string, body: object, accessToken?: string): Promise<Response> => {
    const req = request(app.getHttpServer()).patch(`${USERS_URL}/${path}`).send(body);
    return accessToken === undefined ? req : req.set('Authorization', `Bearer ${accessToken}`);
  };

  /** Setup steps that must succeed before the real assertions. */
  const patchOk = async (path: string, body: object, accessToken: string): Promise<void> => {
    expect((await patch(path, body, accessToken)).status).toBe(200);
  };

  const loginWith =async (email: string, password: string): Promise<Response> =>
    request(app.getHttpServer()).post(`${AUTH_URL}/login`).send({ email, password });

  const storedUser = async (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

  /** Field names of a 400 validation error ('' = the whole body). */
  const fieldsOf = (res: Response): string[] =>
    (bodyOf(res, errorBodySchema).details ?? []).map((detail) => detail.field);

  describe('PATCH /users/profile', () => {
    it('should return the updated user, and GET /auth/me should show the new name', async () => {
      const { accessToken, userId } = await registerUser(app);

      const res = await patch('profile', { fullName: 'New Name' }, accessToken);

      expect(res.status).toBe(200);
      expect(bodyOf(res, userBodySchema).data).toEqual({
        id: userId,
        email: 'hien@example.com',
        fullName: 'New Name',
        avatarUrl: null,
        createdAt: expect.any(String),
      });
      expect(bodyOf(await me(app, accessToken), userBodySchema).data.fullName).toBe('New Name');
    });

    // Same rule as register: tags are removed, the text between them is kept (now inert)
    it('should store fullName without HTML tags', async () => {
      const { accessToken, userId } = await registerUser(app);

      await patchOk('profile', { fullName: '<b>Hien</b> <script>alert(1)</script>' }, accessToken);

      expect((await storedUser(userId)).fullName).toBe('Hien alert(1)');
    });

    it('should reject an empty body with 400', async () => {
      const { accessToken } = await registerUser(app);

      const res = await patch('profile', {}, accessToken);

      expect(res.status).toBe(400);
      expect(bodyOf(res, errorBodySchema).details).toEqual([
        { field: '', message: USER_ERROR.NO_FIELDS },
      ]);
    });

    it.each([
      ['empty', ''],
      ['101 characters', 'a'.repeat(101)],
    ])('should reject a fullName that is %s with 400 on fullName', async (_, fullName) => {
      const { accessToken } = await registerUser(app);

      const res = await patch('profile', { fullName }, accessToken);

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toEqual(['fullName']);
    });

    it('should ignore email, isActive and password: stored values unchanged', async () => {
      const { accessToken, userId } = await registerUser(app);
      const before = await storedUser(userId);
      const body = { fullName: 'New Name', email: 'evil@example.com', isActive: false, password: 'Hacked123' };

      await patchOk('profile', body, accessToken);

      const after = await storedUser(userId);
      expect(after.fullName).toBe('New Name');
      expect(after.email).toBe(before.email);
      expect(after.isActive).toBe(true);
      expect(after.password).toBe(before.password);
    });

    it("should change only the caller's own row", async () => {
      const me1 = await registerUser(app, 'me@example.com');
      const other = await registerUser(app, 'other@example.com');

      await patchOk('profile', { fullName: 'New Name' }, me1.accessToken);

      expect((await storedUser(other.userId)).fullName).toBe('Hien Nguyen');
    });
  });

  describe('PATCH /users/password', () => {
    const change = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };

    it('should return 200 with data: null and clear the refresh cookie', async () => {
      const { accessToken } = await registerUser(app);

      const res = await patch('password', change, accessToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: null });
      expect(refreshSetCookie(res)).toMatch(/^refresh_token=;.*Path=\/api\/v1\/auth/);
    });

    it('should accept the new password at login and reject the old one', async () => {
      const { accessToken, email } = await registerUser(app);

      await patchOk('password', change, accessToken);

      expect((await loginWith(email, NEW_PASSWORD)).status).toBe(200);
      expect((await login(app, email)).status).toBe(401); // login() uses the old PASSWORD
    });

    it('should revoke the sessions of EVERY device', async () => {
      const { accessToken, email, cookie: laptop, userId } = await registerUser(app);
      const phone = refreshCookiePair(await login(app, email));
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(2);

      await patchOk('password', change, accessToken);

      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);
      expect((await refresh(app, laptop)).status).toBe(401);
      expect((await refresh(app, phone)).status).toBe(401);
    });

    it('should store a bcrypt hash of the new password, never the plain value', async () => {
      const { accessToken, userId } = await registerUser(app);

      await patchOk('password', change, accessToken);

      const { password } = await storedUser(userId);
      expect(password).toMatch(/^\$2[aby]\$10\$/);
      expect(password).not.toContain(NEW_PASSWORD);
      expect(await verifyPassword(NEW_PASSWORD, password)).toBe(true);
    });

    it('should reject a wrong current password with 400, changing nothing', async () => {
      const { accessToken, userId } = await registerUser(app);
      const before = await storedUser(userId);
      const body = { currentPassword: 'WrongSecret1', newPassword: NEW_PASSWORD };

      const res = await patch('password', body, accessToken);

      expect(res.status).toBe(400);
      expect(bodyOf(res, errorBodySchema).message).toBe(USER_ERROR.CURRENT_PASSWORD_INCORRECT);
      expect((await storedUser(userId)).password).toBe(before.password);
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(1);
      expect(refreshSetCookie(res)).toBeUndefined(); // cookie kept: the user stays logged in
    });

    it('should reject a weak new password with 400 on newPassword', async () => {
      const { accessToken } = await registerUser(app);

      const res = await patch('password', { currentPassword: PASSWORD, newPassword: 'weak' }, accessToken);

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('newPassword');
    });

    it('should reject a new password equal to the current one with 400 on newPassword', async () => {
      const { accessToken } = await registerUser(app);

      const res = await patch('password', { currentPassword: PASSWORD, newPassword: PASSWORD }, accessToken);

      expect(res.status).toBe(400);
      expect(bodyOf(res, errorBodySchema).details).toEqual([
        { field: 'newPassword', message: USER_ERROR.NEW_PASSWORD_SAME },
      ]);
    });
  });

  it.each([
    ['profile', { fullName: 'New Name' }],
    ['password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }],
  ])('PATCH /users/%s should return 401 without an access token', async (path, body) => {
    expect((await patch(path, body)).status).toBe(401);
  });
});
