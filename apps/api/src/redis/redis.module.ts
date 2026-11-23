import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';

import { redisConfig } from '@config/index';

import { REDIS_CLIENT } from './redis.constants';

/**
 * One Redis client for the whole app (readiness now, BullMQ in M6). Redis is disposable
 * (ADR-0027): the app must start and serve requests while it is down.
 * - `lazyConnect`: no connection at boot, so a missing Redis never blocks startup;
 * - `enableOfflineQueue: false`: while disconnected a command fails at once instead of waiting
 *   in a queue, so readiness answers "down" quickly;
 * - `maxRetriesPerRequest: 1`: a command is not retried for long behind a broken connection;
 * - `disconnectTimeout: 100`: `disconnect()` arms a timer that only a socket `close` clears.
 *   While reconnecting the socket is already closed, so the default 2 s timer runs out and
 *   delays shutdown (and keeps Jest from exiting). Redis holds nothing to flush (ADR-0027).
 */
export function createRedisClient(config: ConfigType<typeof redisConfig>): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(config.url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    disconnectTimeout: 100,
  });
  // Without a listener, ioredis prints every reconnect failure as "Unhandled error event"
  client.on('error', (error: Error) => {
    logger.warn(`Redis connection error: ${error.message}`);
  });
  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, inject: [redisConfig.KEY], useFactory: createRedisClient }],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** `disconnect()`, not `quit()`: nothing in Redis must survive (ADR-0027), and it never waits. */
  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}
