import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/auth-store';
import { errorBody, TEST_USER } from '@/test/auth-fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const ME_URL = '/api/v1/auth/me';

beforeEach(() => {
  // Signed in, but the User is not in the cache: the page has to load it
  useAuthStore.setState({ status: 'authenticated', accessToken: 'token' });
});

describe('HomePage', () => {
  it('should show the error in place and load again on retry', async () => {
    let calls = 0;
    server.use(
      http.get(ME_URL, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody(404, 'Not found'), { status: 404 })
          : HttpResponse.json({ success: true, data: TEST_USER });
      }),
    );
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Hello, Hien Bui' })).toBeInTheDocument();
  });
});
