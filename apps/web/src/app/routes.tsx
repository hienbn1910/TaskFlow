import type { RouteObject } from 'react-router';

/**
 * The route table, shared by the browser router (main.tsx) and the tests (memory router), so
 * tests exercise the real routes. Guards, layouts and pages arrive in W5–W7.
 */
export const routes: RouteObject[] = [{ path: '/', element: <h1>TaskFlow</h1> }];
