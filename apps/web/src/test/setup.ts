// toBeInTheDocument(), toHaveTextContent()… on Vitest's expect
import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

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
