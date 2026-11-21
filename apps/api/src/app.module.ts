import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { generateRequestId } from '@common/logging/request-id';
import { appConfig, configLoaders, validateEnv } from '@config/index';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { UsersModule } from '@modules/users/users.module';

import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configLoaders,
      validate: validateEnv,
    }),
    // pino-http: request id + one log line per request (ADR-0035). Level/redact options: task P9
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          genReqId: generateRequestId,
          level: config.nodeEnv === 'test' ? 'silent' : 'info',
        },
      }),
    }),
    PrismaModule,
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
