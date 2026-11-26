import type { RouteObject } from 'react-router';

import { GuestOnly } from '@/app/guards/GuestOnly';
import { RequireAuth } from '@/app/guards/RequireAuth';
import { AppShell } from '@/app/layouts/AppShell';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { RouteError } from '@/app/RouteError';
import { SignInPage } from '@/features/auth/routes/SignInPage';
import { SignUpPage } from '@/features/auth/routes/SignUpPage';
import { HomePage } from '@/features/home/routes/HomePage';
import { NotFoundPage } from '@/shared/ui/NotFoundPage';

/**
 * The route table (spec §6), shared by the browser router (main.tsx) and the tests (memory
 * router), so tests exercise the real routes. Guards and layouts are pathless layout routes;
 * no loader fetches data (server data stays in TanStack Query, ADR-0034). The root
 * `errorElement` catches a render error in any page (spec §7).
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RequireAuth />,
        children: [{ element: <AppShell />, children: [{ path: '/', element: <HomePage /> }] }],
      },
      {
        element: <GuestOnly />,
        children: [
          {
            element: <PublicLayout />,
            children: [
              { path: '/login', element: <SignInPage /> },
              { path: '/register', element: <SignUpPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
