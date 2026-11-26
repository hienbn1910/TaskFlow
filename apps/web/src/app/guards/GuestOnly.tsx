import { Navigate, Outlet, useSearchParams } from 'react-router';

import { useAuthStore } from '@/features/auth/auth-store';
import { safeNext } from '@/shared/lib/safe-next';
import { FullPageLoader } from '@/shared/ui/FullPageLoader';

/**
 * Layout route of sign-in and sign-up (spec §6): an authenticated User goes on to `next`,
 * only when it stays in the app (`safeNext`), else home.
 */
export function GuestOnly() {
  const status = useAuthStore((state) => state.status);
  const [searchParams] = useSearchParams();

  if (status === 'unknown') return <FullPageLoader />;
  if (status === 'authenticated') {
    return <Navigate to={safeNext(searchParams.get('next'))} replace />;
  }
  return <Outlet />;
}
