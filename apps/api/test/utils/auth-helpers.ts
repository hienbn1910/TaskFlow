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
});

/** Same bootstrap as production (setupApp: prefix, cookie-parser, helmet, CORS). */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
  return { email, accessToken: data.accessToken, cookie: refreshCookiePair(res), userId: data.user.id };
}

export async function login(app: INestApplication<App>, email: string): Promise<Response> {
  return request(app.getHttpServer()).post(`${AUTH_URL}/login`).send({ email, password: PASSWORD });
}

export async function refresh(app: INestApplication<App>, cookie?: string): Promise<Response> {
  const req = request(app.getHttpServer()).post(`${AUTH_URL}/refresh`);
  return cookie === undefined ? req : req.set('Cookie', cookie);
}

export async function me(app: INestApplication<App>, accessToken?: string): Promise<Response> {
  const req = request(app.getHttpServer()).get(`${AUTH_URL}/me`);
  return accessToken === undefined ? req : req.set('Authorization', `Bearer ${accessToken}`);
}
