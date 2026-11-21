import { ArgumentsHost, Catch, Injectable } from '@nestjs/common';
import type { Response } from 'express';

import { RefreshCookieService } from '@common/cookies/refresh-cookie.service';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { InvalidOriginException } from '@common/guards/origin.guard';

/**
 * Used only on POST /auth/refresh. Any error there means the refresh cookie is useless (missing,
 * expired, reused...), so it is cleared before the normal error response is sent. Exception: a
 * request from a foreign Origin (see `catch`).
 * Doing it here keeps the controller free of try/catch logic (RULE.md §3).
 * Extends GlobalExceptionFilter, so the error body and logging stay identical.
 */
@Catch()
@Injectable()
export class RefreshCookieFilter extends GlobalExceptionFilter {
  constructor(private readonly cookies: RefreshCookieService) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    // A foreign origin never reached the cookie: it must not be able to clear it either (ADR-0020)
    if (!(exception instanceof InvalidOriginException)) {
      this.cookies.clear(host.switchToHttp().getResponse<Response>());
    }
    super.catch(exception, host);
  }
}
