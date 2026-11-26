import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthMeQueryKey } from '@/api/generated/endpoints/auth/auth';
import { ApiError, request } from '@/api/http';
import { queryClient } from '@/app/query-client';
import { errorBody, REFRESH_URL, refreshBody, TEST_USER } from '@/test/auth-fixtures';
import { server } from '@/test/server';

import { initialAuthState, useAuthStore } from '../auth-store';
import { refreshSession, startSession, withRefreshLock } from '../session';

const THINGS_URL = '/api/v1/things';

/** Counts `POST /auth/refresh`; answers like the API, after a short wait so callers overlap. */
function refreshAnswers(respond: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.post(REFRESH_URL, async () => {
      calls.count += 1;
      await delay(20);
      return respond();
    }),
  );
  return calls;
}

function store() {
  return useAuthStore.getState();
}

beforeEach(() => {
  useAuthStore.setState(initialAuthState);
  queryClient.clear();
});

describe('refreshSession', () => {
  it('should send one refresh for five requests that get 401 together, then retry each once', async () => {
    store().signIn('old-token');
    const refresh = refreshAnswers(() => HttpResponse.json(refreshBody('new-token')));
    const authHeaders: (string | null)[] = [];
    server.use(
      http.get(THINGS_URL, ({ request: req }) => {
        authHeaders.push(req.headers.get('Authorization'));
        return req.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json({ success: true, data: 'ok' })
          : HttpResponse.json(errorBody(401, 'Unauthorized'), { status: 401 });
      }),
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, async () => request(THINGS_URL, { method: 'GET' })),
    );

    expect(refresh.count).toBe(1);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    // 5 first tries with the old token, 5 retries with the new one, nothing more
    expect(authHeaders.filter((h) => h === 'Bearer old-token')).toHaveLength(5);
    expect(authHeaders.filter((h) => h === 'Bearer new-token')).toHaveLength(5);
  });

  it('should store the new token and seed the User under the /auth/me key on 200', async () => {
    refreshAnswers(() => HttpResponse.json(refreshBody('new-token')));

    await refreshSession();

    expect(store()).toMatchObject({ accessToken: 'new-token', status: 'authenticated' });
    expect(queryClient.getQueryData(getAuthMeQueryKey())).toEqual(TEST_USER);
  });

  it.each([401, 403])('should end the session and clear the cache on %i', async (status) => {
    store().signIn('old-token');
    queryClient.setQueryData(['/api/v1/workspaces'], ['private data']);
    refreshAnswers(() => HttpResponse.json(errorBody(status, 'Session expired'), { status }));

    await refreshSession();

    expect(store()).toMatchObject({ accessToken: null, status: 'anonymous' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('should keep the session and reject when the refresh fails for another reason', async () => {
    store().signIn('old-token');
    refreshAnswers(() => HttpResponse.json(errorBody(503, 'Unavailable'), { status: 503 }));

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

    expect(store()).toMatchObject({ accessToken: 'old-token', status: 'authenticated' });
  });

  it('should send a new refresh once the previous one has settled', async () => {
    const refresh = refreshAnswers(() => HttpResponse.json(refreshBody('new-token')));

    await refreshSession();
    await refreshSession();

    expect(refresh.count).toBe(2);
  });
});

describe('startSession', () => {
  it('should become anonymous after one refresh when the network fails at boot', async () => {
    const refresh = refreshAnswers(() => HttpResponse.error());

    await startSession();

    expect(store()).toMatchObject({ accessToken: null, status: 'anonymous' });
    expect(refresh.count).toBe(1);
  });

  it('should be authenticated after a successful boot refresh', async () => {
    refreshAnswers(() => HttpResponse.json(refreshBody('new-token')));

    await startSession();

    expect(store().status).toBe('authenticated');
  });
});

describe('withRefreshLock', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('should run the callback inside the taskflow-refresh lock when Web Locks exist', async () => {
    const lockRequest = vi.fn(async (_name: string, callback: () => Promise<void>) => callback());
    Object.defineProperty(navigator, 'locks', {
      value: { request: lockRequest },
      configurable: true,
    });
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });

    await withRefreshLock(callback);

    expect(lockRequest).toHaveBeenCalledWith('taskflow-refresh', callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should run the callback directly when Web Locks do not exist', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve();
    });

    await withRefreshLock(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
