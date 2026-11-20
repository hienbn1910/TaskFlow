import { Module } from '@nestjs/common';

import { CookieModule } from '@common/cookies/cookie.module';

import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Users feature module: the current user's profile and password.
 * Exports UsersRepository to AuthModule (auth → users). Never imports AuthModule back:
 * what both need lives in common/ (CookieModule, field schemas) or here (canSignIn).
 */
@Module({
  imports: [CookieModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository],
})
export class UsersModule {}
