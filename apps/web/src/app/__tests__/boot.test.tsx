import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { startSession } from '@/features/auth/session';
import { errorBody, REFRESH_URL, refreshBody, TEST_USER } from '@/test/auth-fixtures';
import { locationOf, renderApp } from '@/test/render';
import { server } from '@/test/server';

const ME_URL = '/api/v1/auth/me';

/** Boots like main.tsx: the refresh starts before the first render, not in an effect. */
function boot(path: string) {
  void startSession();
  return renderApp(path);
}

describe('boot', () => {
  it('should show the loader, then greet the User without requesting /auth/me', async () => {
    let meCalls = 0;
    server.use(
      http.post(REFRESH_URL, async () => {
        await delay(20);
        return HttpResponse.json(refreshBody('token'));
      }),
      http.get(ME_URL, () => {
        meCalls += 1;
        return HttpResponse.json({ success: true, data: TEST_USER });
      }),
    );

    boot('/');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Hello, Hien Bui' })).toBeInTheDocument();
    expect(meCalls).toBe(0);
  });

  it('should show the sign-in page when the refresh cookie is gone', async () => {
    server.use(
      http.post(REFRESH_URL, () =>
        HttpResponse.json(errorBody(401, 'Invalid refresh token'), { status: 401 }),
      ),
    );

    const router = boot('/');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/login?next=%2F');
  });
});
