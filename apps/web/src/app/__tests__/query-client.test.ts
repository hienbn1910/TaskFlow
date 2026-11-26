import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/http';

import { shouldRetryQuery } from '../query-client';

function apiError(status: number) {
  return new ApiError({ status, message: 'failed' });
}

/** Queries retry what can pass on a second try, never what will fail again (spec §7). */
describe('shouldRetryQuery', () => {
  it.each([400, 401, 403, 404, 409, 429])('should not retry a %i', (status) => {
    expect(shouldRetryQuery(0, apiError(status))).toBe(false);
  });

  it.each([
    ['a 5xx', apiError(503)],
    ['a network failure', apiError(0)],
    ['an unexpected error', new Error('boom')],
  ])('should retry %s twice, then stop', (_case, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });
});
