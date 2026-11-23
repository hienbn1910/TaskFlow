import { TimeoutError, withTimeout } from '../with-timeout.util';

/** A promise settled by hand, so the test decides when it resolves or rejects. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve with the value when the promise settles before the timeout', async () => {
    const pending = deferred<string>();
    const result = withTimeout(pending.promise, 3000);

    pending.resolve('up');
    jest.advanceTimersByTime(3000);

    await expect(result).resolves.toBe('up');
  });

  it('should reject with a TimeoutError when the promise is still pending after the timeout', async () => {
    const pending = deferred<string>();
    const result = withTimeout(pending.promise, 3000);

    jest.advanceTimersByTime(3000);

    await expect(result).rejects.toBeInstanceOf(TimeoutError);
  });

  it('should not time out one millisecond early', async () => {
    const pending = deferred<string>();
    const result = withTimeout(pending.promise, 3000);

    jest.advanceTimersByTime(2999);
    pending.resolve('just in time');

    await expect(result).resolves.toBe('just in time');
  });

  it('should reject with the original error when the promise rejects first', async () => {
    const pending = deferred<string>();
    const result = withTimeout(pending.promise, 3000);
    const failure = new Error('connection refused');

    pending.reject(failure);

    await expect(result).rejects.toBe(failure);
  });

  // A forgotten timer keeps Node (and Jest) alive for up to `ms` after every check
  it('should clear its timer once the promise settles', async () => {
    const pending = deferred<string>();
    const result = withTimeout(pending.promise, 3000);

    pending.resolve('up');
    await result;

    expect(jest.getTimerCount()).toBe(0);
  });
});
