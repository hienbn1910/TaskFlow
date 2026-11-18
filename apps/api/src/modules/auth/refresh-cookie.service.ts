import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { appConfig } from '@config/index';

import { buildClearCookieOptions, buildRefreshCookieOptions } from './refresh-cookie';
import { TokenService } from './token.service';

/**
 * The only place that reads, sets or clears the refresh cookie (HTTP concern).
 * Used by AuthController and RefreshCookieFilter, so the attributes can never diverge.
 */
@Injectable()
export class RefreshCookieService {
  constructor(
    @Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>,
    private readonly tokens: TokenService,
  ) {}

  /** cookie-parser types cookies as `any`: narrowed to string so no `any` leaks out. */
  read(request: Request): string | undefined {
    const value: unknown = request.cookies[REFRESH_COOKIE_NAME];
    return typeof value === 'string' ? value : undefined;
  }

  set(response: Response, refreshToken: string): void {
    const options = buildRefreshCookieOptions(
      this.config.isProduction,
      this.tokens.refreshMaxAgeMs(),
    );
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, options);
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, buildClearCookieOptions(this.config.isProduction));
  }
}
