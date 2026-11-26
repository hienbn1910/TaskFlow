import { getAuthMeQueryKey, getAuthRefreshUrl } from '@/api/generated/endpoints/auth/auth';
import type { AuthResponseDtoOutput } from '@/api/generated/model';
import { ApiError, rawRequest } from '@/api/http';
import { queryClient } from '@/app/query-client';

import { useAuthStore } from './auth-store';

const REFRESH_LOCK = 'taskflow-refresh';

/** The refresh running in this tab, shared by every caller until it settles. */
let inFlight: Promise<void> | null = null;

/**
 * Renews the access token with the refresh cookie (spec §5.2). The API has no grace window:
 * sending a rotated refresh token again revokes every session (ADR-0005). So there is at most
 * one refresh per tab (single flight) and one per browser (Web Lock).
 * Rejects only when the refresh failed without ending the session (network, 429, 5xx).
 */
export async function refreshSession(): Promise<void> {
  inFlight ??= refreshThenRelease();
  return inFlight;
}

/** The refresh under the lock; frees the in-flight slot however it ends. */
async function refreshThenRelease(): Promise<void> {
  try {
    await withRefreshLock(requestNewSession);
  } finally {
    inFlight = null;
  }
}

/** One `POST /auth/refresh` and its result applied to the store and the cache. */
async function requestNewSession(): Promise<void> {
  let auth: AuthResponseDtoOutput;
  try {
    auth = await rawRequest<AuthResponseDtoOutput>(getAuthRefreshUrl(), { method: 'POST' });
  } catch (error) {
    if (!isSessionGone(error)) throw error;
    useAuthStore.getState().signOut();
    // Nothing of the previous User may stay on screen (ADR-0034)
    queryClient.clear();
    return;
  }
  useAuthStore.getState().signIn(auth.accessToken);
  // The home page reads the User from here: no GET /auth/me after a refresh
  queryClient.setQueryData(getAuthMeQueryKey(), auth.user);
}

/** 401 / 403: the refresh token is missing, expired or revoked. */
function isSessionGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * The boot refresh: called once at module level in main.tsx, never in an effect (StrictMode
 * runs effects twice). Any failure that did not end the session still settles the status:
 * the User sees the login page, and the cookie is kept for the next reload.
 */
export async function startSession(): Promise<void> {
  try {
    await refreshSession();
  } catch {
    useAuthStore.getState().signOut();
  }
}

/**
 * Runs `fn` while holding a browser-wide lock, so a second tab waits and then refreshes with
 * the cookie the first one already rotated. Without Web Locks, only the in-tab guard applies.
 */
export async function withRefreshLock(fn: () => Promise<void>): Promise<void> {
  if (!('locks' in navigator)) {
    await fn();
    return;
  }
  await navigator.locks.request(REFRESH_LOCK, fn);
}
