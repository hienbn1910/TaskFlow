import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';

import { appConfig } from '@config/index';

export const INVALID_ORIGIN_MESSAGE = 'Invalid origin';

/**
 * 403 for a request from a foreign origin. Its own class so RefreshCookieFilter can tell it
 * apart: answering a foreign page with "clear the cookie" would let any site log the User out.
 */
export class InvalidOriginException extends ForbiddenException {
  constructor() {
    super(INVALID_ORIGIN_MESSAGE);
  }
}

/**
 * CSRF defence in depth for the routes that act on the refresh cookie (ADR-0020):
 * POST /auth/refresh and /auth/logout. A browser always sends `Origin` on a POST, so:
 * - `Origin` exactly equal to FRONTEND_URL → allowed;
 * - any other value, or no `Origin` at all → 403, before the handler reads any session.
 * Exact string comparison on purpose: `startsWith`/`includes` would accept look-alikes such as
 * `http://localhost:5173.evil.example`. No `Referer` fallback.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  /** `Origin` never has a trailing slash or a path: FRONTEND_URL is normalized to the same form. */
  private readonly allowedOrigin: string;

  constructor(@Inject(appConfig.KEY) config: ConfigType<typeof appConfig>) {
    this.allowedOrigin = new URL(config.frontendUrl).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const { origin } = context.switchToHttp().getRequest<Request>().headers;
    if (origin !== this.allowedOrigin) {
      throw new InvalidOriginException();
    }
    return true;
  }
}
