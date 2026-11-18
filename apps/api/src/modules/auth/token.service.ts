import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';

import { AUTH_ERROR, JWT_ALGORITHM } from '@common/constants/auth.constant';
import { parseDurationMs } from '@common/utils/duration.util';
import { jwtConfig } from '@config/index';

/**
 * Payload shapes, checked at runtime: a valid signature only proves WE signed the token,
 * Zod proves it has the fields the code relies on. Extra claims (iat, exp) are dropped.
 */
const accessPayloadSchema = z.object({ sub: z.uuid() });
const refreshPayloadSchema = z.object({ sub: z.uuid(), jti: z.uuid() });

export type AccessPayload = z.infer<typeof accessPayloadSchema>;
export type RefreshPayload = z.infer<typeof refreshPayloadSchema>;

interface VerifyRule<T> {
  readonly secret: string;
  readonly schema: z.ZodType<T>;
  readonly errorMessage: string;
}

/**
 * Signs and verifies JWTs. No database access.
 * Access and refresh tokens use different secrets, so one can never be accepted as the other.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  async signAccess(userId: string): Promise<string> {
    const payload: AccessPayload = { sub: userId };
    return this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      expiresIn: toSeconds(this.config.accessExpiry),
      algorithm: JWT_ALGORITHM,
    });
  }

  /** `jti` (random id) makes every refresh token unique, even two issued in the same second. */
  async signRefresh(userId: string): Promise<string> {
    const payload: RefreshPayload = { sub: userId, jti: randomUUID() };
    return this.jwt.signAsync(payload, {
      secret: this.config.refreshSecret,
      expiresIn: toSeconds(this.config.refreshExpiry),
      algorithm: JWT_ALGORITHM,
    });
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    return this.verify(token, {
      secret: this.config.accessSecret,
      schema: accessPayloadSchema,
      errorMessage: AUTH_ERROR.UNAUTHORIZED,
    });
  }

  async verifyRefresh(token: string): Promise<RefreshPayload> {
    return this.verify(token, {
      secret: this.config.refreshSecret,
      schema: refreshPayloadSchema,
      errorMessage: AUTH_ERROR.INVALID_REFRESH_TOKEN,
    });
  }

  /** When a refresh token issued now expires. Stored in `refresh_tokens.expiresAt`. */
  refreshExpiresAt(): Date {
    return new Date(Date.now() + parseDurationMs(this.config.refreshExpiry));
  }

  /** Expiry of the refresh token in ms, for the cookie `maxAge`. */
  refreshMaxAgeMs(): number {
    return parseDurationMs(this.config.refreshExpiry);
  }

  /**
   * Any failure (bad signature, expired, wrong algorithm, malformed, wrong payload shape)
   * becomes the same 401: the client is not told WHY its token was rejected.
   */
  private async verify<T>(token: string, rule: VerifyRule<T>): Promise<T> {
    try {
      const payload = await this.jwt.verifyAsync<object>(token, {
        secret: rule.secret,
        algorithms: [JWT_ALGORITHM],
      });
      return rule.schema.parse(payload);
    } catch {
      throw new UnauthorizedException(rule.errorMessage);
    }
  }
}

/** jsonwebtoken reads a number as seconds. Converting avoids its narrow string type ("7d"). */
function toSeconds(duration: string): number {
  return Math.floor(parseDurationMs(duration) / 1000);
}
