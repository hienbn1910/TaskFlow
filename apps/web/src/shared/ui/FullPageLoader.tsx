/** Shown while the session status is still `unknown` (spec §6). */
export function FullPageLoader() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center text-gray-500">
      Loading…
    </div>
  );
}
