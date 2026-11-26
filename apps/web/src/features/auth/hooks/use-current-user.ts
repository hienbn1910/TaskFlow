import { useAuthMe } from '@/api/generated/endpoints/auth/auth';

/**
 * The signed-in User, from the cache `refreshSession` fills (ADR-0034). `staleTime: Infinity`:
 * with the default (0) every mount refetches `GET /auth/me` in the background, though the data
 * just arrived with the refresh. The User changes only through their own actions (profile,
 * feature/web-auth), which update this cache entry.
 */
export function useCurrentUser() {
  return useAuthMe({ query: { staleTime: Infinity } });
}
