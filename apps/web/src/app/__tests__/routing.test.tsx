import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { getAuthMeQueryKey } from '@/api/generated/endpoints/auth/auth';
import { queryClient } from '@/app/query-client';
import { initialAuthState, type SessionStatus, useAuthStore } from '@/features/auth/auth-store';
import { TEST_USER } from '@/test/auth-fixtures';
import { locationOf, renderApp } from '@/test/render';

/** Renders the app at `path` with the session already in `status`, as a refresh leaves it. */
function renderAt(path: string, status: SessionStatus) {
  const authenticated = status === 'authenticated';
  useAuthStore.setState({ status, accessToken: authenticated ? 'token' : null });
  if (authenticated) queryClient.setQueryData(getAuthMeQueryKey(), TEST_USER);
  return renderApp(path);
}

beforeEach(() => {
  useAuthStore.setState(initialAuthState);
  queryClient.clear();
});

describe('routing', () => {
  it.each(['/', '/login'])('should show the loader on %s while the session is unknown', (path) => {
    renderAt(path, 'unknown');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('should send an anonymous User from a protected page to login with next', async () => {
    const router = renderAt('/', 'anonymous');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/login?next=%2F');
  });

  it('should keep the path and query of the protected page in next', async () => {
    const router = renderAt('/?tab=2', 'anonymous');

    await screen.findByRole('heading', { name: 'Sign in' });
    expect(locationOf(router)).toBe('/login?next=%2F%3Ftab%3D2');
  });

  it('should show the protected page to an authenticated User', () => {
    renderAt('/', 'authenticated');

    expect(screen.getByRole('heading', { name: 'Hello, Hien Bui' })).toBeInTheDocument();
  });

  it('should show a guest-only page to an anonymous User', () => {
    renderAt('/register', 'anonymous');

    expect(screen.getByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('should send an authenticated User from login to a valid next', async () => {
    const router = renderAt('/login?next=%2F', 'authenticated');

    expect(await screen.findByRole('heading', { name: 'Hello, Hien Bui' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/');
  });

  it('should send an authenticated User from login to the target of next', async () => {
    const router = renderAt('/login?next=%2Fsettings', 'authenticated');

    // /settings does not exist yet: the redirect itself is what is tested
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(locationOf(router)).toBe('/settings');
  });

  it('should ignore a next that leaves the app', async () => {
    const router = renderAt('/login?next=%2F%2Fevil.example', 'authenticated');

    expect(await screen.findByRole('heading', { name: 'Hello, Hien Bui' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/');
  });

  it('should show the not-found page at once, even while the session is unknown', () => {
    renderAt('/no/such/page', 'unknown');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
