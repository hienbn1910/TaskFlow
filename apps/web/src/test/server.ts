import { setupServer } from 'msw/node';

/**
 * The fake API for tests: the network is the only boundary we mock (ADR-0039). Each test adds
 * its handlers with `server.use(...)`; they are reset after every test (setup.ts).
 */
export const server = setupServer();
