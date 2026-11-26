import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../AppProviders';
import { routes } from '../routes';

function CrashingPage(): never {
  throw new Error('secret internal detail');
}

/**
 * The real root route (with its `errorElement`), its children replaced by a page that crashes:
 * proves the error page is wired at the root without mocking a module of the app (ADR-0039).
 */
function renderCrashingPage() {
  const [root] = routes;
  if (root === undefined) throw new Error('routes has no root route');
  const router = createMemoryRouter([
    { errorElement: root.errorElement, children: [{ path: '/', element: <CrashingPage /> }] },
  ]);
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

beforeEach(() => {
  // React and the router log the caught error: expected here, noise in the output
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('route error', () => {
  it('should show an error page with a reload button when a page crashes', () => {
    renderCrashingPage();

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
  });
});
