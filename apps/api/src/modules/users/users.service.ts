import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { USER_ERROR } from '@common/constants/user.constant';
import type { UserResponse } from '@common/types/user-response.dto';
import { hashPassword, verifyPassword } from '@common/utils/password.util';

import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserResponse } from './mappers/user.mapper';
import { canSignIn } from './user.rules';
import { UsersRepository } from './users.repository';

/**
 * The current User's own profile. `userId` always comes from the access token
 * (@CurrentUser), never from the URL or body, so a user can only change themselves.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly users: UsersRepository) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponse> {
    // Fields copied one by one into the closed UpdateProfileData type
    const user = await this.users.updateProfile(userId, { fullName: dto.fullName });
    return toUserResponse(user);
  }

  /**
   * Spec §3.2. Checks the current password, stores the hash of the new one and revokes
   * every session in one atomic write. "New ≠ current" is already checked by the DTO.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findCredentialsById(userId);
    // Same rule as the guard: the User may have been blocked since the token was issued
    if (user === null || !canSignIn(user)) {
      throw new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED);
    }
    // 400, not 401: the user is authenticated, only a form field is wrong (spec §3.2)
    if (!(await verifyPassword(dto.currentPassword, user.password))) {
      throw new BadRequestException(USER_ERROR.CURRENT_PASSWORD_INCORRECT);
    }
    const passwordHash = await hashPassword(dto.newPassword);
    await this.users.updatePasswordAndRevokeSessions(user.id, passwordHash);
    this.logger.log(`Password changed, all sessions revoked for user ${user.id}`);
  }
}
