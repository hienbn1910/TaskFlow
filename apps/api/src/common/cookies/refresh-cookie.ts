import type { CookieOptions } from 'express';

import { REFRESH_COOKIE_PATH } from '@common/constants/auth.constant';

/**
 * Attributes shared by "set" and "clear". A browser only deletes a cookie when the clear
 * request uses the SAME path (and, for cross-site cookies, the same secure/sameSite), so both
 * operations are built from this one function (spec §2.5).
 */
export function buildClearCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true, // unreadable from JavaScript: an XSS cannot steal it
    secure: isProduction, // HTTPS only in production; localhost runs on plain HTTP
    // Lax everywhere (ADR-0020): the browser reaches the API through the web app's own origin
    // (Vercel /api proxy in production, Vite proxy locally), so the cookie is first-party.
    // Lax also keeps the cookie off cross-site POSTs; OriginGuard adds a second check.
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH, // sent only to /api/v1/auth/*
  };
}

/** Same attributes + `maxAge`, so the cookie expires together with the refresh JWT. */
export function buildRefreshCookieOptions(isProduction: boolean, maxAgeMs: number): CookieOptions {
  return { ...buildClearCookieOptions(isProduction), maxAge: maxAgeMs };
}
