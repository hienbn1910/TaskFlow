import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/auth-store';
import { errorBody, REFRESH_URL, refreshBody } from '@/test/auth-fixtures';
import { server } from '@/test/server';

import { ApiError, request } from '../http';

const URL = '/api/v1/things';
const REQUEST_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34';

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

  it('should throw a generic ApiError when a 2xx body is not JSON', async () => {
    // A misconfigured rewrite serves the SPA's index.html with 200 for an /api URL
    server.use(http.get(URL, () => new HttpResponse('<!doctype html><html></html>')));

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error).toMatchObject({ status: 200, message: 'Unexpected response from the server' });
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

describe('request with an access token', () => {
  /** The Authorization header of every call the endpoint received, in order. */
  let authHeaders: (string | null)[];
  /** `POST /auth/refresh` calls; the refresh answers 200 with `new-token` unless a test says so. */
  let refreshCalls: number;

  /** The endpoint answers each call with the next status of the list. */
  function respondWith(...statuses: number[]) {
    server.use(
      http.get(URL, ({ request: req }) => {
        authHeaders.push(req.headers.get('Authorization'));
        const status = statuses[authHeaders.length - 1] ?? 500;
        return status === 200
          ? HttpResponse.json({ success: true, data: { id: 't1' } })
          : HttpResponse.json(errorBody(status, 'Unauthorized'), { status });
      }),
    );
  }

  function refreshAnswers(status: number) {
    server.use(
      http.post(REFRESH_URL, () => {
        refreshCalls += 1;
        return status === 200
          ? HttpResponse.json(refreshBody('new-token'))
          : HttpResponse.json(errorBody(status, 'Session expired'), { status });
      }),
    );
  }

  beforeEach(() => {
    authHeaders = [];
    refreshCalls = 0;
    refreshAnswers(200);
  });

  it('should send the access token as a Bearer header', async () => {
    useAuthStore.getState().signIn('old-token');
    respondWith(200);

    await request(URL, { method: 'GET' });

    expect(authHeaders).toEqual(['Bearer old-token']);
  });

  it('should refresh once and retry once with the new token after a 401', async () => {
    useAuthStore.getState().signIn('old-token');
    respondWith(401, 200);

    await expect(request(URL, { method: 'GET' })).resolves.toEqual({ id: 't1' });

    expect(refreshCalls).toBe(1);
    expect(authHeaders).toEqual(['Bearer old-token', 'Bearer new-token']);
  });

  it('should throw the second 401 instead of refreshing again', async () => {
    useAuthStore.getState().signIn('old-token');
    respondWith(401, 401);

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error.status).toBe(401);
    expect(refreshCalls).toBe(1);
    expect(authHeaders).toHaveLength(2);
  });

  it('should throw the 401 without retrying when the refresh ends the session', async () => {
    useAuthStore.getState().signIn('old-token');
    refreshAnswers(401);
    respondWith(401);

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error).toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(authHeaders).toHaveLength(1);
  });

  it('should throw a 401 at once when the request was sent without a token', async () => {
    respondWith(401);

    const error = await errorOf(request(URL, { method: 'GET' }));

    expect(error.status).toBe(401);
    expect(refreshCalls).toBe(0);
    expect(authHeaders).toEqual([null]);
  });

  it('should send the refresh without the expired token', async () => {
    let refreshAuthorization: string | null = 'not called';
    server.use(
      http.post(REFRESH_URL, ({ request: req }) => {
        refreshAuthorization = req.headers.get('Authorization');
        return HttpResponse.json(refreshBody('new-token'));
      }),
    );
    useAuthStore.getState().signIn('old-token');
    respondWith(401, 200);

    await request(URL, { method: 'GET' });

    expect(refreshAuthorization).toBeNull();
  });
});
