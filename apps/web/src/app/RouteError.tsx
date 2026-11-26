/**
 * The router's `errorElement` (spec §7): a page crashed while rendering. The error itself is
 * never shown, it may hold internal details; error tracking arrives with Sentry (ADR-0035).
 */
export function RouteError() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-gray-600">This page failed to load. Reloading usually fixes it.</p>
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        className="rounded-control bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
      >
        Reload
      </button>
    </main>
  );
}
