// toBeInTheDocument(), toHaveTextContent()… on Vitest's expect
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

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
