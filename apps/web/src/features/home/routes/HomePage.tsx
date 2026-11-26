import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { FullPageLoader } from '@/shared/ui/FullPageLoader';

/** Placeholder home of the walking skeleton: proves the session and the cache work end to end. */
export function HomePage() {
  const { data: user, isError } = useCurrentUser();

  if (isError) return <p role="alert">Your details could not be loaded. Reload the page.</p>;
  if (user === undefined) return <FullPageLoader />;
  return <h1 className="p-6 text-2xl font-semibold">Hello, {user.fullName}</h1>;
}
