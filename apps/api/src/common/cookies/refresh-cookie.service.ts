import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { parseDurationMs } from '@common/utils/duration.util';
import { appConfig, jwtConfig } from '@config/index';

import { buildClearCookieOptions, buildRefreshCookieOptions } from './refresh-cookie';

/**
 * The only place that reads, sets or clears the refresh cookie (HTTP concern).
 * Shared by the auth module (login, refresh, logout) and the users module (password change),
 * so the attributes can never diverge. Depends on config only, not on any feature module.
 */
@Injectable()
export class RefreshCookieService {
  constructor(
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    @Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  /** cookie-parser types cookies as `any`: narrowed to string so no `any` leaks out. */
  read(request: Request): string | undefined {
    const value: unknown = request.cookies[REFRESH_COOKIE_NAME];
    return typeof value === 'string' ? value : undefined;
  }

  /** `maxAge` comes from the same setting as the JWT expiry: both expire together. */
  set(response: Response, refreshToken: string): void {
    const maxAgeMs = parseDurationMs(this.jwt.refreshExpiry);
    const options = buildRefreshCookieOptions(this.app.isProduction, maxAgeMs);
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, options);
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, buildClearCookieOptions(this.app.isProduction));
  }
}
