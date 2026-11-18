import { Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { AUTH_ERROR, REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import type { appConfig } from '@config/index';

import { RefreshCookieFilter } from '../filters/refresh-cookie.filter';
import { buildClearCookieOptions, buildRefreshCookieOptions } from '../refresh-cookie';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

describe('RefreshCookieFilter', () => {
  const config = (isProduction: boolean): ConfigType<typeof appConfig> => ({
    nodeEnv: isProduction ? 'production' : 'development',
    port: 3000,
    frontendUrl: 'http://localhost:5173',
    isProduction,
  });

  const createResponse = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { clearCookie: jest.fn(), status, json };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([true, false])('should clear the refresh cookie (production: %p)', (isProduction) => {
    const response = createResponse();
    const request = { method: 'POST', originalUrl: '/api/v1/auth/refresh' };
    const host = new ExecutionContextHost([request, response]);
    const filter = new RefreshCookieFilter(config(isProduction));

    filter.catch(new UnauthorizedException(), host);

    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      buildClearCookieOptions(isProduction),
    );
  });

  it('should still send the standard error body', () => {
    const response = createResponse();
    const request = { method: 'POST', originalUrl: '/api/v1/auth/refresh' };
    const host = new ExecutionContextHost([request, response]);
    const filter = new RefreshCookieFilter(config(false));

    filter.catch(new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN), host);

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
