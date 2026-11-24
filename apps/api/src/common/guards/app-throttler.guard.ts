import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { THROTTLE_CREDENTIALS_KEY } from '@common/decorators/throttle-credentials.decorator';
import { credentialsKey } from '@common/throttling/credentials-key';
import { THROTTLER } from '@common/throttling/throttle.constants';

/**
 * Rate limiting with named throttlers (ADR-0031, plan §3.1). For each throttler this guard
 * decides whether it applies to the request and with which key:
 * - `anonymous`: the client IP, for requests WITHOUT a User;
 * - `user`: the User id, for requests WITH a User (set by JwtAuthGuard, which runs first);
 * - `credentials`: IP + normalized email, only on routes marked @ThrottleCredentials().
 * A throttler that does not apply is skipped (no counter touched).
 *
 * The IP is `req.ip` (honours TRUST_PROXY, ADR-0020), normalized by the base guard (IPv6 grouped
 * by /56, so rotating addresses inside one subnet does not escape the limit). Never a raw header.
 *
 * Registered as APP_GUARD in AuthModule right AFTER JwtAuthGuard (plan §3.3).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const tracker = await this.trackerFor(props.throttler.name, props.context);
    if (tracker === undefined) {
      return true;
    }
    return super.handleRequest({ ...props, getTracker: () => tracker });
  }

  /** One plain `Retry-After` (seconds), as RFC 9110 defines it, then the standard 429. */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', String(detail.timeToBlockExpire));
    await super.throwThrottlingException(context, detail);
  }

  private async trackerFor(
    name: string | undefined,
    context: ExecutionContext,
  ): Promise<string | undefined> {
    const request = context.switchToHttp().getRequest<Request>();
    switch (name) {
      case THROTTLER.ANONYMOUS:
        return request.user === undefined ? this.getTracker(request) : undefined;
      case THROTTLER.USER:
        return request.user?.id;
      case THROTTLER.CREDENTIALS:
        return this.credentialsEnabled(context)
          ? credentialsKey(await this.getTracker(request), request.body)
          : undefined;
      default:
        return undefined;
    }
  }

  private credentialsEnabled(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(THROTTLE_CREDENTIALS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
