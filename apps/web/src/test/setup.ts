// toBeInTheDocument(), toHaveTextContent()… on Vitest's expect
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { queryClient } from '@/app/query-client';
import { initialAuthState, useAuthStore } from '@/features/auth/auth-store';

import { server } from './server';

// The store and the query client are module singletons (plan §3.3): each test starts signed
// out with an empty cache, then sets what it needs in its own beforeEach
beforeEach(() => {
  useAuthStore.setState(initialAuthState);
  queryClient.clear();
});

// Testing Library unmounts after each test only when Vitest globals are on; they are not
afterEach(() => {
  cleanup();
});

// A request without a handler fails the test instead of reaching the real network
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
