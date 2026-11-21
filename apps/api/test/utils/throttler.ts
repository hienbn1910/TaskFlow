import type { INestApplication, OnApplicationShutdown } from '@nestjs/common';
import { getStorageToken, type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

/**
 * The REAL in-memory storage of @nestjs/throttler, behind a handle that can swap it for a fresh
 * one. Not a mock: every count, window and block is computed by the library. Needed because the
 * library keeps its hit counters in a private map that cannot be cleared from outside.
 */
export class ResettableThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private inner = new ThrottlerStorageService();

  async increment(
    ...args: Parameters<ThrottlerStorage['increment']>
  ): ReturnType<ThrottlerStorage['increment']> {
    return this.inner.increment(...args);
  }

  reset(): void {
    this.inner.onApplicationShutdown(); // stops the old instance's sweep timer
    this.inner = new ThrottlerStorageService();
  }

  onApplicationShutdown(): void {
    this.inner.onApplicationShutdown();
  }
}

/** Token under which the throttler storage is provided (a Symbol, not the class). */
export const THROTTLER_STORAGE = getStorageToken();

/**
 * Fresh rate-limit counters, so each test starts clean and tests stay independent (RULE.md §7).
 * The throttler stays ON in every test: no env switch (spec §6.3).
 */
export function resetThrottler(app: INestApplication): void {
  const storage: unknown = app.get(THROTTLER_STORAGE);
  if (!(storage instanceof ResettableThrottlerStorage)) {
    throw new Error('resetThrottler needs an app built by createTestApp()');
  }
  storage.reset();
}
