import { MutationCache, type MutationMeta, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError, GENERIC_MESSAGE } from '@/api/http';

declare module '@tanstack/react-query' {
  interface Register {
    /** `meta: { toast: false }`: the mutation shows its error itself (a form field, a dialog). */
    mutationMeta: { readonly toast?: boolean };
  }
}

const MAX_QUERY_RETRIES = 2;

/**
 * A 4xx fails the same way on a second try (and 401 is already handled by `request`); a 5xx,
 * a network failure or an unknown error may pass. Errors then show in place (spec §7).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * The toast of a failed mutation (spec §7): the API message and the request id the User can
 * report (ADR-0035). Not for a 401: the session flow already sent them to sign in.
 */
function toastMutationError(error: unknown, meta: MutationMeta | undefined): void {
  if (meta?.toast === false) return;
  if (error instanceof ApiError && error.status === 401) return;
  const apiError = error instanceof ApiError ? error : undefined;
  toast.error(apiError?.message ?? GENERIC_MESSAGE, {
    description: apiError?.requestId === undefined ? undefined : `Error ID: ${apiError.requestId}`,
  });
}

/**
 * The one query client: a module singleton, so `refreshSession` can seed and clear the cache
 * outside React (plan §3.3). Server state lives only here (ADR-0034).
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    // TanStack's signature: (error, variables, onMutateResult, mutation, context)
    // eslint-disable-next-line max-params -- the callback shape is the library's, not ours
    onError: (error, _variables, _onMutateResult, mutation) => {
      toastMutationError(error, mutation.meta);
    },
  }),
  defaultOptions: { queries: { retry: shouldRetryQuery } },
});
