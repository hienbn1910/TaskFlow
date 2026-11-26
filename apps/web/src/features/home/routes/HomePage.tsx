import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FullPageLoader } from '@/shared/ui/FullPageLoader';

/** Placeholder home of the walking skeleton: proves the session and the cache work end to end. */
export function HomePage() {
  const { data: user, isError, refetch } = useCurrentUser();

  if (isError) {
    return (
      <ErrorState
        message="Your details could not be loaded."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (user === undefined) return <FullPageLoader />;
  return <h1 className="p-6 text-2xl font-semibold">Hello, {user.fullName}</h1>;
}
