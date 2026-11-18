import { ArgumentsHost, Catch, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';

import { REFRESH_COOKIE_NAME } from '@common/constants/auth.constant';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { appConfig } from '@config/index';

import { buildClearCookieOptions } from '../refresh-cookie';

/**
 * Used only on POST /auth/refresh. Any error there means the refresh cookie is useless
 * (missing, expired, reused...), so it is cleared before the normal error response is sent.
 * Doing it here keeps the controller free of try/catch logic (RULE.md §3).
 * Extends GlobalExceptionFilter, so the error body and logging stay identical.
 */
@Catch()
@Injectable()
export class RefreshCookieFilter extends GlobalExceptionFilter {
  constructor(@Inject(appConfig.KEY) private readonly config: ConfigType<typeof appConfig>) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.clearCookie(REFRESH_COOKIE_NAME, buildClearCookieOptions(this.config.isProduction));
    super.catch(exception, host);
  }
}
