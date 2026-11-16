import { Module } from '@nestjs/common';

import { UsersRepository } from './users.repository';

/**
 * Users feature module. For now it only exposes UsersRepository to AuthModule;
 * profile endpoints (controller + service) arrive in branch feature/user-profile.
 */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
