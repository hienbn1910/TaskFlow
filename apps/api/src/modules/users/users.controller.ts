import { Body, Controller, HttpCode, Patch, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';

import { RefreshCookieService } from '@common/cookies/refresh-cookie.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ROUTE_LIMITS, THROTTLER } from '@common/throttling/throttle.constants';
import type { AuthUser } from '@common/types/auth-user.type';
import { type UserResponse, UserResponseDto } from '@common/types/user-response.dto';

import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/**
 * HTTP layer only (RULE.md §3). Both routes act on the authenticated user: there is no
 * user id in the URL or body, so a user cannot edit someone else (spec §2).
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Patch('profile')
  @ZodResponse({ status: 200, type: UserResponseDto, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    return this.usersService.updateProfile(user.id, dto);
  }

  /**
   * Every session is revoked, so the refresh cookie now points to a deleted session.
   * It is cleared to avoid a false "refresh token reuse" alarm on the next refresh (spec §3.2).
   * Only reached on success: if the service throws, the cookie is left as it was.
   */
  @Patch('password')
  // A stolen access token must not allow guessing the current password (ADR-0031)
  @Throttle({ [THROTTLER.USER]: ROUTE_LIMITS.CHANGE_PASSWORD_PER_USER })
  @HttpCode(200)
  @ApiOkResponse({ description: 'Password changed, all sessions revoked, cookie cleared (data: null)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.usersService.changePassword(user.id, dto);
    this.cookies.clear(response);
  }
}
