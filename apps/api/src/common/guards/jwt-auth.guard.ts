import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { canSignIn } from '@modules/auth/auth.service';
import { TokenService } from '@modules/auth/token.service';
import { UsersRepository } from '@modules/users/users.repository';

// Exactly "Bearer <token>": one space, no extra parts. The scheme is case-insensitive (RFC 7235).
const BEARER_REGEX = /^Bearer ([^\s]+)$/i;

/** Returns the token of an `Authorization: Bearer <token>` header, or null for anything else. */
export function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  return BEARER_REGEX.exec(header)?.[1] ?? null;
}

/**
 * Global guard (registered as APP_GUARD in AuthModule): every route requires a valid
 * access token unless marked @Public(). Secure by default: a new route without any
 * decorator is protected, not open.
 *
 * Loads the user on every request so a blocked or deleted account loses access immediately,
 * instead of keeping it until its access token expires (up to 15 min).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);
    if (token === null) {
      throw new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED);
    }
    const { sub } = await this.tokens.verifyAccess(token);
    const user = await this.users.findActiveById(sub);
    if (user === null || !canSignIn(user)) {
      throw new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED);
    }
    request.user = { id: user.id, email: user.email };
    return true;
  }

  /** @Public() on the method OR on the whole controller class. */
  private isPublic(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic === true;
  }
}
