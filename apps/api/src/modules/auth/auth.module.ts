import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { CookieModule } from '@common/cookies/cookie.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UsersModule } from '@modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

@Module({
  // No global secret: TokenService passes the access or refresh secret on every call,
  // so a token can never be signed or verified with the wrong one by default.
  imports: [UsersModule, CookieModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    RefreshTokenRepository,
    // Global guard, registered here so Nest resolves its dependencies (TokenService,
    // UsersRepository) from this module. Applies to every route of the app.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
