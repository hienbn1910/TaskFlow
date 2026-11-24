import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { buildLoggerOptions } from '@common/logging/logger.options';
import { THROTTLER_OPTIONS } from '@common/throttling/throttler.options';
import { appConfig, configLoaders, validateEnv } from '@config/index';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { UsersModule } from '@modules/users/users.module';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configLoaders,
      validate: validateEnv,
    }),
    // pino-http: request id + one JSON line per request, secrets redacted (ADR-0035)
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: buildLoggerOptions(config),
      }),
    }),
    // Rate limiting in memory (ADR-0031). The guard is registered in AuthModule, after JwtAuthGuard
    ThrottlerModule.forRoot(THROTTLER_OPTIONS),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Validates @Body/@Query/@Param against their createZodDto schema
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Order matters: the FIRST registered interceptor is the OUTERMOST.
    // 1. ResponseInterceptor (outer) wraps into { success, data }
    // 2. ZodSerializerInterceptor (inner) runs first on the raw result: parses it with the
    //    @ZodResponse schema and drops every field not in the schema (e.g. password)
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
