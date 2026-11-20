import { Module } from '@nestjs/common';

import { RefreshCookieService } from './refresh-cookie.service';

/**
 * Shared HTTP cookie handling. Imported by AuthModule and UsersModule, so neither has to
 * import the other (RULE.md §1: no circular module dependencies).
 * Config (appConfig, jwtConfig) comes from the global ConfigModule.
 */
@Module({
  providers: [RefreshCookieService],
  exports: [RefreshCookieService],
})
export class CookieModule {}
