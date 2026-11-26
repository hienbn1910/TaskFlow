import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { routes } from '@/app/routes';

/** Renders the real route table at `path` inside the same providers as main.tsx. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** Where the router ended up, path and query. */
export function locationOf(router: ReturnType<typeof createMemoryRouter>): string {
  const { pathname, search } = router.state.location;
  return pathname + search;
}
