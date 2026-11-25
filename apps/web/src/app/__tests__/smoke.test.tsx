import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '../routes';

// W0: the toolchain works end to end (Vite + React + React Router 8 data mode + jsdom)
describe('app smoke test', () => {
  it('should render the home route through a data router', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(screen.getByText('TaskFlow')).toBeInTheDocument();
  });
});
