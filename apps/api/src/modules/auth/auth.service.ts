import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import type { UserResponse } from '@common/types/user-response.dto';
import { sha256Hex } from '@common/utils/hash.util';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '@common/utils/password.util';
import type { UserEntity } from '@modules/users/entities/user.entity';
import { toUserResponse } from '@modules/users/mappers/user.mapper';
import { canSignIn } from '@modules/users/user.rules';
import { UsersRepository } from '@modules/users/users.repository';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AuthSession } from './entities/auth-session.entity';
import type { NewRefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

/** A signed token pair + the DB row that will represent it. Nothing is stored yet. */
interface SignedSession {
  readonly session: AuthSession;
  readonly record: NewRefreshToken;
}

/** All auth business rules (spec §3). Data access goes through the repositories only. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    if (await this.users.existsByEmail(dto.email)) {
      throw new ConflictException(AUTH_ERROR.EMAIL_ALREADY_REGISTERED);
    }
    const user = await this.users.create({
      email: dto.email,
      password: await hashPassword(dto.password),
      fullName: dto.fullName,
    });
    return this.startSession(user);
  }

  /**
   * Every failure throws the SAME 401 and runs bcrypt exactly once, so neither the message
   * nor the response time tells whether the email exists (spec §3.2).
   */
  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (user === null) {
      await verifyAgainstDummy(dto.password);
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }
    // Password checked BEFORE the account status, so a blocked account costs the same time
    const passwordMatches = await verifyPassword(dto.password, user.password);
    if (!passwordMatches || !canSignIn(user)) {
      throw new UnauthorizedException(AUTH_ERROR.INVALID_CREDENTIALS);
    }
    await this.users.updateLastLogin(user.id);
    return this.startSession(user);
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.users.findActiveById(userId);
    if (user === null || !canSignIn(user)) {
      throw new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED);
    }
    return toUserResponse(user);
  }

  /**
   * Refresh token rotation (spec §3.3). The old token is consumed and a new pair is issued.
   * Errors are all the same 401, and the controller's filter clears the cookie.
   */
  async refresh(token: string | undefined): Promise<AuthSession> {
    if (token === undefined || token === '') {
      throw new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN);
    }
    const payload = await this.tokens.verifyRefresh(token);
    const user = await this.users.findActiveById(payload.sub);
    if (user === null || !canSignIn(user)) {
      throw new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN);
    }
    return this.rotateSession(user, sha256Hex(token));
  }

  /**
   * Ends the current session. Idempotent and never throws: no cookie, an unknown token or a
   * second call all succeed. The signature is not checked: deleting by hash is harmless.
   */
  async logout(token: string | undefined): Promise<void> {
    if (token === undefined || token === '') {
      return;
    }
    await this.refreshTokens.deleteByHash(sha256Hex(token));
  }

  /** Issues a token pair and stores the refresh token's HASH as a new session (spec §4.1). */
  private async startSession(user: UserEntity): Promise<AuthSession> {
    const { session, record } = await this.signSession(user);
    await this.refreshTokens.create(record);
    return session;
  }

  /**
   * Swaps the session `oldHash` for a new one. If `oldHash` is already gone, the JWT is valid
   * but was used before: someone replayed a rotated or logged-out token. As we cannot tell the
   * thief from the owner, every session of the user is revoked (Decision #5).
   */
  private async rotateSession(user: UserEntity, oldHash: string): Promise<AuthSession> {
    const { session, record } = await this.signSession(user);
    const rotated = await this.refreshTokens.rotate(oldHash, record);
    if (!rotated) {
      await this.refreshTokens.deleteAllForUser(user.id);
      this.logger.warn(`Refresh token reuse detected, all sessions revoked for user ${user.id}`);
      throw new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN);
    }
    return session;
  }

  private async signSession(user: UserEntity): Promise<SignedSession> {
    // Two independent signing operations, no DB write: safe to run in parallel (RULE.md §2)
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(user.id),
      this.tokens.signRefresh(user.id),
    ]);
    return {
      session: { accessToken, refreshToken, user: toUserResponse(user) },
      record: {
        userId: user.id,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: this.tokens.refreshExpiresAt(),
      },
    };
  }
}
