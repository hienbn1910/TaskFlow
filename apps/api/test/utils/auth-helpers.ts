import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { z } from 'zod';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { userResponseSchema } from '@common/types/user-response.dto';

import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/setup-app';
import { ResettableThrottlerStorage, THROTTLER_STORAGE } from './throttler';

export const AUTH_URL = '/api/v1/auth';
export const PASSWORD = 'Secret123';

/** Response envelopes, checked with Zod so tests get typed bodies without casts. */
export const authBodySchema = z.object({
  success: z.literal(true),
  data: z.object({ accessToken: z.string(), user: userResponseSchema }),
});

export const userBodySchema = z.object({ success: z.literal(true), data: userResponseSchema });

export const errorBodySchema = z.object({
  success: z.literal(false),
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  timestamp: z.string(),
  requestId: z.uuid(),
});

/** A provider replaced by a real object of the same kind (e.g. a Redis client on a dead port). */
export interface ProviderOverride {
  readonly token: string | symbol;
  readonly value: unknown;
}

/**
 * Same bootstrap as production (setupApp: prefix, cookie-parser, helmet, CORS). Only the
 * throttler storage is swapped for the resettable wrapper around the real one (utils/throttler),
 * plus any `overrides` a test asks for.
 */
export async function createTestApp(
  overrides: readonly ProviderOverride[] = [],
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(THROTTLER_STORAGE)
    .useClass(ResettableThrottlerStorage);
  for (const { token, value } of overrides) {
    builder.overrideProvider(token).useValue(value);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

/** supertest types `body` as any: parsing it fails the test if the shape is wrong. */
export function bodyOf<T>(res: Response, schema: z.ZodType<T>): T {
  return schema.parse(res.body);
}

/** The raw `Set-Cookie` header for the refresh cookie, or undefined if none was sent. */
export function refreshSetCookie(res: Response): string | undefined {
  const header: unknown = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header.filter((c) => typeof c === 'string') : [];
  return cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));
}

/** "refresh_token=<jwt>" ready to send back in a `Cookie` header. */
export function refreshCookiePair(res: Response): string {
  const setCookie = refreshSetCookie(res);
  const pair = setCookie?.split(';')[0];
  if (pair === undefined || pair === `${REFRESH_COOKIE_NAME}=`) {
    throw new Error('Response did not set a refresh cookie');
  }
  return pair;
}

/** The JWT inside a "refresh_token=<jwt>" pair. */
export function tokenOf(cookiePair: string): string {
  return cookiePair.slice(REFRESH_COOKIE_NAME.length + 1);
}

export interface RegisteredUser {
  readonly email: string;
  readonly accessToken: string;
  readonly cookie: string;
  readonly userId: string;
}

export async function registerUser(
  app: INestApplication<App>,
  email = 'hien@example.com',
): Promise<RegisteredUser> {
  const res = await request(app.getHttpServer())
    .post(`${AUTH_URL}/register`)
    .send({ email, password: PASSWORD, fullName: 'Hien Nguyen' })
    .expect(201);
  const { data } = bodyOf(res, authBodySchema);
  return {
    email,
    accessToken: data.accessToken,
    cookie: refreshCookiePair(res),
    userId: data.user.id,
  };
}

export async function login(app: INestApplication<App>, email: string): Promise<Response> {
  return request(app.getHttpServer()).post(`${AUTH_URL}/login`).send({ email, password: PASSWORD });
}

/** The web app's origin (FRONTEND_URL of .env.test): what a browser sends on cookie routes. */
export const FRONTEND_ORIGIN = 'http://localhost:5173';

/**
 * A POST to a cookie route (/auth/refresh, /auth/logout) as a browser sends it: with an `Origin`
 * header (ADR-0020). `origin: null` sends none, like curl.
 */
function cookieRoute(
  app: INestApplication<App>,
  path: 'refresh' | 'logout',
  options: { cookie?: string | undefined; origin?: string | null | undefined },
): request.Test {
  const req = request(app.getHttpServer()).post(`${AUTH_URL}/${path}`);
  const { cookie, origin = FRONTEND_ORIGIN } = options;
  if (origin !== null) req.set('Origin', origin);
  if (cookie !== undefined) req.set('Cookie', cookie);
  return req;
}

export async function refresh(
  app: INestApplication<App>,
  cookie?: string,
  origin?: string | null,
): Promise<Response> {
  return cookieRoute(app, 'refresh', { cookie, origin });
}

export async function logout(
  app: INestApplication<App>,
  cookie?: string,
  origin?: string | null,
): Promise<Response> {
  return cookieRoute(app, 'logout', { cookie, origin });
}

export async function me(app: INestApplication<App>, accessToken?: string): Promise<Response> {
  const req = request(app.getHttpServer()).get(`${AUTH_URL}/me`);
  return accessToken === undefined ? req : req.set('Authorization', `Bearer ${accessToken}`);
}
