import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import type { UserResponse } from '@common/types/user-response.dto';
import { sha256Hex } from '@common/utils/hash.util';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '@common/utils/password.util';
import type { UserEntity } from '@modules/users/entities/user.entity';
import { toUserResponse } from '@modules/users/mappers/user.mapper';
import { UsersRepository } from '@modules/users/users.repository';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AuthSession } from './entities/auth-session.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

/** A user may sign in (or keep using a token) only if active and not soft-deleted. */
export function canSignIn(user: UserEntity): boolean {
  return user.isActive && user.deletedAt === null;
}

/** All auth business rules (spec §3). Data access goes through the repositories only. */
@Injectable()
export class AuthService {
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

  /** Issues a token pair and stores the refresh token's HASH as a new session (spec §4.1). */
  private async startSession(user: UserEntity): Promise<AuthSession> {
    // Two independent signing operations, no DB write: safe to run in parallel (RULE.md §2)
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(user.id),
      this.tokens.signRefresh(user.id),
    ]);
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: this.tokens.refreshExpiresAt(),
    });
    return { accessToken, refreshToken, user: toUserResponse(user) };
  }
}
