import { Outlet } from 'react-router';

/** Layout of sign-in, sign-up and later invitations (spec §3): one card centred on the page. */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6">
      <p className="text-xl font-semibold text-brand-700">TaskFlow</p>
      <main className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-8 shadow-sm">
        <Outlet />
      </main>
    </div>
  );
}
