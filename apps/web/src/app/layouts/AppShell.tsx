import { Link, Outlet } from 'react-router';

import { useCurrentUser } from '@/features/auth/hooks/use-current-user';

/**
 * Layout of the protected pages (spec §3): top bar with the app name and the User's name, an
 * empty menu slot (sign out arrives in feature/web-auth), then the page. No sidebar yet.
 */
export function AppShell() {
  const { data: user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <Link to="/" className="font-semibold text-brand-700">
          TaskFlow
        </Link>
        <nav aria-label="User menu" className="text-sm text-gray-700">
          {user?.fullName}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
