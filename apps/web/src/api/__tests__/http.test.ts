import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';

import { ApiError, request } from '../http';

const URL = '/api/v1/things';
const REQUEST_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34';

/** The API's standard error body (ADR-0001, ADR-0035). */
function errorBody(statusCode: number, message: string, extra: object = {}) {
  return {
    success: false,
    statusCode,
    error: 'ERROR',
    message,
    timestamp: '2026-11-25T00:00:00.000Z',
    requestId: REQUEST_ID,
    ...extra,
  };
}

/** The error `request` rejected with (fails the test if it resolved). */
async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

describe('request', () => {
  it('should return the unwrapped data of a 2xx response', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ success: true, data: { id: 't1' } })));

    await expect(request(URL, { method: 'GET' })).resolves.toEqual({ id: 't1' });
  });

  it('should return undefined for a 204 without body', async () => {
    server.use(http.post(URL, () => new HttpResponse(null, { status: 204 })));

    await expect(request(URL, { method: 'POST' })).resolves.toBeUndefined();
  });

  it('should throw an ApiError with message and requestId from the standard body', async () => {
    server.use(
      http.get(URL, () => HttpResponse.json(errorBody(409, 'Already exists'), { status: 409 })),
    );

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error).toMatchObject({ status: 409, message: 'Already exists', requestId: REQUEST_ID });
  });

  it('should keep the field details of a validation error', async () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    server.use(
      http.post(URL, () =>
        HttpResponse.json(errorBody(400, 'Validation failed', { details }), { status: 400 }),
      ),
    );

    const error = await errorOf(request(URL, { method: 'POST' }));

    expect(error.details).toEqual(details);
  });

  it('should throw a generic ApiError when the error body is not the standard one', async () => {
    server.use(http.get(URL, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })));

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error).toMatchObject({ status: 502, message: 'Something went wrong. Try again.' });
    expect(error.requestId).toBeUndefined();
  });

  it('should throw an ApiError with status 0 when the network fails', async () => {
    server.use(http.get(URL, () => HttpResponse.error()));

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error).toMatchObject({
      status: 0,
      message: 'Cannot reach the server. Check your connection.',
    });
  });
});
