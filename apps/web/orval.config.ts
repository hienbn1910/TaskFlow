import { defineConfig } from 'orval';

const INPUT = '../api/openapi.json';
const OUTPUT_DIR = 'src/api/generated';

/**
 * `AuthController_me` → `authMe` (hooks `useAuthMe`, `getAuthMeQueryKey`): Nest's operationIds
 * carry the class name, which says nothing to the frontend. Fails loudly on another format.
 */
function operationName(operation: { operationId?: string }): string {
  const match = /^(\w+)Controller_(\w+)$/.exec(operation.operationId ?? '');
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`Unexpected operationId: ${String(operation.operationId)}`);
  }
  const [, controller, method] = match;
  return `${controller.charAt(0).toLowerCase()}${controller.slice(1)}${method.charAt(0).toUpperCase()}${method.slice(1)}`;
}

/**
 * Client code from the API's committed contract (ADR-0033). Output is gitignored and
 * regenerated before dev, build, typecheck, test and lint (`pre*` scripts).
 */
export default defineConfig({
  // Typed request functions + TanStack Query hooks, one file per tag (auth, users, health)
  api: {
    input: INPUT,
    output: {
      target: `${OUTPUT_DIR}/endpoints`,
      schemas: `${OUTPUT_DIR}/model`,
      mode: 'tags-split',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        operationName,
        // Every request goes through our fetch wrapper: token, envelope, 401 refresh (spec §5)
        mutator: { path: 'src/api/http.ts', name: 'request' },
        // The wrapper returns the DTO itself, not { data, status, headers }
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  // Zod schemas of the same operations, for forms (feature/web-auth)
  zod: {
    input: INPUT,
    output: {
      target: `${OUTPUT_DIR}/zod`,
      mode: 'tags-split',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
      override: { operationName },
    },
  },
});
