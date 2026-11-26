import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { routes } from '@/app/routes';
import { startSession } from '@/features/auth/session';

// Once, before the first render: never in an effect, which StrictMode runs twice in development
// (two refreshes = the second replays a rotated token and revokes every session, ADR-0005).
// It never rejects: any failure settles the status (spec §5.2).
void startSession();

const router = createBrowserRouter(routes);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html has no #root element');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
