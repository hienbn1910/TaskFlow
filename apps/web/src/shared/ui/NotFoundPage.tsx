import { Link } from 'react-router';

/** Rendered at once for an unknown path, whatever the session status (spec §6). */
export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="underline">
        Back to home
      </Link>
    </main>
  );
}
