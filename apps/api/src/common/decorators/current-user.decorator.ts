import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import type { AuthUser } from '@common/types/auth-user.type';

/**
 * Reads the user that JwtAuthGuard attached to the request.
 * Exported separately from the decorator so it can be unit tested directly.
 *
 * Throws instead of returning undefined: if `user` is missing, the route is @Public()
 * or the guard did not run, and the handler must not continue as if someone were logged in.
 */
export function getCurrentUser(_data: unknown, context: ExecutionContext): AuthUser {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.user) {
    throw new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED);
  }
  return request.user;
}

/** Usage: `me(@CurrentUser() user: AuthUser)` */
export const CurrentUser = createParamDecorator(getCurrentUser);
