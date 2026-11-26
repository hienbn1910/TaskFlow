import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { initialAuthState, type SessionStatus, useAuthStore } from '@/features/auth/auth-store';

import { routes } from '../routes';

/** Renders the real route table at `path` with the session already in `status`. */
function renderAt(path: string, status: SessionStatus) {
  useAuthStore.setState({ status, accessToken: status === 'authenticated' ? 'token' : null });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

/** Where the router ended up, path and query. */
function locationOf(router: ReturnType<typeof createMemoryRouter>): string {
  const { pathname, search } = router.state.location;
  return pathname + search;
}

beforeEach(() => {
  useAuthStore.setState(initialAuthState);
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

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('should show a guest-only page to an anonymous User', () => {
    renderAt('/register', 'anonymous');

    expect(screen.getByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('should send an authenticated User from login to a valid next', async () => {
    const router = renderAt('/login?next=%2F', 'authenticated');

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/');
  });

  it('should show the not-found page at once, even while the session is unknown', () => {
    renderAt('/no/such/page', 'unknown');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
