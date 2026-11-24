import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { appConfig, jwtConfig } from '@config/index';

import { buildClearCookieOptions, buildRefreshCookieOptions } from '../refresh-cookie';
import { RefreshCookieService } from '../refresh-cookie.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

const appConfigFor = (isProduction: boolean): ConfigType<typeof appConfig> => ({
  nodeEnv: isProduction ? 'production' : 'development',
  port: 3000,
  frontendUrl: 'http://localhost:5173',
  isProduction,
  trustProxy: 0,
  logLevel: undefined,
});

const jwtConfigWith = (refreshExpiry: string): ConfigType<typeof jwtConfig> => ({
  accessSecret: 'a'.repeat(32),
  refreshSecret: 'b'.repeat(32),
  accessExpiry: '15m',
  refreshExpiry,
});

/** Real RefreshCookieService, wired by Nest with fake configs. */
const createService = async (isProduction: boolean, refreshExpiry = '7d') => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RefreshCookieService,
      { provide: appConfig.KEY, useValue: appConfigFor(isProduction) },
      { provide: jwtConfig.KEY, useValue: jwtConfigWith(refreshExpiry) },
    ],
  }).compile();
  return moduleRef.get(RefreshCookieService);
};

// Express Request/Response are large interfaces; these tests only touch `cookies`,
// `cookie()` and `clearCookie()`, so partial objects are cast on purpose.
const requestWithCookies = (cookies: Record<string, unknown>): Request =>
  ({ cookies }) as unknown as Request;

const createResponse = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

describe('refresh cookie options', () => {
  // ADR-0020: web and API share one origin through the /api proxy, so the cookie is same-site
  it('should be SameSite=Lax and HTTPS-only in production', () => {
    expect(buildRefreshCookieOptions(true, SEVEN_DAYS_MS)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: SEVEN_DAYS_MS,
    });
  });

  it('should work on plain-HTTP localhost in development', () => {
    expect(buildRefreshCookieOptions(false, SEVEN_DAYS_MS)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: SEVEN_DAYS_MS,
    });
  });

  it.each([true, false])(
    'should clear with the same attributes as set, minus maxAge (production: %p)',
    (isProduction) => {
      const { maxAge, ...setAttributes } = buildRefreshCookieOptions(isProduction, SEVEN_DAYS_MS);

      expect(maxAge).toBe(SEVEN_DAYS_MS);
      expect(buildClearCookieOptions(isProduction)).toEqual(setAttributes);
    },
  );
});

describe('RefreshCookieService', () => {
  it('should read the refresh cookie', async () => {
    const service = await createService(false);

    expect(service.read(requestWithCookies({ [REFRESH_COOKIE_NAME]: 'refresh.jwt' }))).toBe(
      'refresh.jwt',
    );
  });

  it.each([{}, { [REFRESH_COOKIE_NAME]: 123 }, { [REFRESH_COOKIE_NAME]: ['a', 'b'] }])(
    'should return undefined for missing or non-string cookie %p',
    async (cookies) => {
      const service = await createService(false);

      expect(service.read(requestWithCookies(cookies))).toBeUndefined();
    },
  );

  it('should set the cookie with maxAge from the refresh expiry', async () => {
    const service = await createService(true);
    const response = createResponse();

    service.set(response as unknown as Response, 'refresh.jwt');

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh.jwt',
      buildRefreshCookieOptions(true, SEVEN_DAYS_MS),
    );
  });

  it('should follow JWT_REFRESH_EXPIRY, not a hard-coded 7 days', async () => {
    const service = await createService(false, '30m');
    const response = createResponse();

    service.set(response as unknown as Response, 'refresh.jwt');

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh.jwt',
      expect.objectContaining({ maxAge: THIRTY_MINUTES_MS }),
    );
  });

  it.each([true, false])('should clear the cookie (production: %p)', async (isProduction) => {
    const service = await createService(isProduction);
    const response = createResponse();

    service.clear(response as unknown as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      buildClearCookieOptions(isProduction),
    );
  });
});
