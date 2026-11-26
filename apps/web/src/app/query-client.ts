import { QueryClient } from '@tanstack/react-query';

/**
 * The one query client: a module singleton, so `refreshSession` can seed and clear the cache
 * outside React (plan §3.3). Server state lives only here (ADR-0034).
 */
export const queryClient = new QueryClient();
