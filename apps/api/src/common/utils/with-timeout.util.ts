/** Thrown by `withTimeout` when the promise did not settle in time. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${String(ms)} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Settles like `promise`, or rejects with TimeoutError after `ms` if it is still pending.
 * Used by the readiness check, so a database or Redis that hangs answers "down" in bounded
 * time (spec §7.4). The timer is always cleared: no handle is left behind.
 * The original operation is NOT cancelled; it only stops being waited for.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
