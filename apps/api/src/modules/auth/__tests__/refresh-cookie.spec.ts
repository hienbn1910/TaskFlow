import { Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AUTH_ERROR, REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { appConfig } from '@config/index';

import { RefreshCookieFilter } from '../filters/refresh-cookie.filter';
import { buildClearCookieOptions, buildRefreshCookieOptions } from '../refresh-cookie';
import { RefreshCookieService } from '../refresh-cookie.service';
import { TokenService } from '../token.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const appConfigFor = (isProduction: boolean): ConfigType<typeof appConfig> => ({
  nodeEnv: isProduction ? 'production' : 'development',
  port: 3000,
  frontendUrl: 'http://localhost:5173',
  isProduction,
});

/** Real RefreshCookieService + RefreshCookieFilter, wired by Nest with a fake config. */
const createCookieProviders = async (isProduction: boolean) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RefreshCookieService,
      RefreshCookieFilter,
      { provide: appConfig.KEY, useValue: appConfigFor(isProduction) },
      { provide: TokenService, useValue: { refreshMaxAgeMs: () => SEVEN_DAYS_MS } },
    ],
  }).compile();
  return {
    service: moduleRef.get(RefreshCookieService),
    filter: moduleRef.get(RefreshCookieFilter),
  };
};

const createResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { cookie: jest.fn(), clearCookie: jest.fn(), status, json };
};

describe('refresh cookie options', () => {
  it('should be cross-site and HTTPS-only in production', () => {
    expect(buildRefreshCookieOptions(true, SEVEN_DAYS_MS)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
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
  // Express Request/Response are large interfaces; these tests only touch `cookies`,
  // `cookie()` and `clearCookie()`, so partial objects are cast on purpose.
  const requestWithCookies = (cookies: Record<string, unknown>): Request =>
    ({ cookies }) as unknown as Request;

  it('should read the refresh cookie', async () => {
    const { service } = await createCookieProviders(false);

    expect(service.read(requestWithCookies({ [REFRESH_COOKIE_NAME]: 'refresh.jwt' }))).toBe(
      'refresh.jwt',
    );
  });

  it.each([{}, { [REFRESH_COOKIE_NAME]: 123 }, { [REFRESH_COOKIE_NAME]: ['a', 'b'] }])(
    'should return undefined for missing or non-string cookie %p',
    async (cookies) => {
      const { service } = await createCookieProviders(false);

      expect(service.read(requestWithCookies(cookies))).toBeUndefined();
    },
  );

  it('should set the cookie with maxAge from the refresh expiry', async () => {
    const { service } = await createCookieProviders(true);
    const response = createResponse();

    service.set(response as unknown as Response, 'refresh.jwt');

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh.jwt',
      buildRefreshCookieOptions(true, SEVEN_DAYS_MS),
    );
  });
});

describe('RefreshCookieFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const hostFor = (response: ReturnType<typeof createResponse>): ExecutionContextHost =>
    new ExecutionContextHost([{ method: 'POST', originalUrl: '/api/v1/auth/refresh' }, response]);

  it.each([true, false])('should clear the refresh cookie (production: %p)', async (isProd) => {
    const { filter } = await createCookieProviders(isProd);
    const response = createResponse();

    filter.catch(new UnauthorizedException(), hostFor(response));

    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      buildClearCookieOptions(isProd),
    );
  });

  it('should still send the standard error body', async () => {
    const { filter } = await createCookieProviders(false);
    const response = createResponse();

    filter.catch(new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: AUTH_ERROR.INVALID_REFRESH_TOKEN,
      timestamp: expect.any(String),
    });
  });
});
