import { Body, Controller, Get, HttpCode, Post, Req, Res, UseFilters } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ZodResponse } from 'nestjs-zod';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import type { AuthUser } from '@common/types/auth-user.type';
import { type UserResponse, UserResponseDto } from '@common/types/user-response.dto';

import { AuthService } from './auth.service';
import { type AuthResponse, AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthSession } from './entities/auth-session.entity';
import { RefreshCookieFilter } from './filters/refresh-cookie.filter';
import { RefreshCookieService } from './refresh-cookie.service';

/**
 * HTTP layer only (RULE.md §3): read input, call AuthService, move the refresh token
 * into the cookie. `passthrough: true` keeps Nest in charge of the response body,
 * so the interceptors still validate and wrap it.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Post('register')
  @ZodResponse({ status: 201, type: AuthResponseDto, description: 'Account created, logged in' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.sendSession(await this.authService.register(dto), response);
  }

  @Public()
  @Post('login')
  @ZodResponse({ status: 200, type: AuthResponseDto, description: 'Logged in' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.sendSession(await this.authService.login(dto), response);
  }

  @Public()
  @Post('refresh')
  @UseFilters(RefreshCookieFilter)
  @ApiCookieAuth()
  @ZodResponse({ status: 200, type: AuthResponseDto, description: 'Token pair rotated' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.refresh(this.cookies.read(request));
    return this.sendSession(session, response);
  }

  /** Public: must work even when the access token has already expired (spec §3.4). */
  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Session ended, cookie cleared (data: null)' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.cookies.read(request));
    this.cookies.clear(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ZodResponse({ status: 200, type: UserResponseDto, description: 'Current user' })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return this.authService.getProfile(user.id);
  }

  /** Refresh token → httpOnly cookie. Body gets ONLY { accessToken, user }, never the session. */
  private sendSession(session: AuthSession, response: Response): AuthResponse {
    this.cookies.set(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }
}
