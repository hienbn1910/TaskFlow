import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '@/features/auth/auth-store';
import { FullPageLoader } from '@/shared/ui/FullPageLoader';

/**
 * Layout route of the protected pages (spec §6): waits for the boot refresh, then sends an
 * anonymous User to login, keeping where they wanted to go in `next`.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const { pathname, search } = useLocation();

  if (status === 'unknown') return <FullPageLoader />;
  if (status === 'anonymous') {
    const next = encodeURIComponent(pathname + search);
    // replace: Back must not return to a page that redirects again
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
