/**
 * Auth constants shared by the auth module, the global JwtAuthGuard and the tests.
 * See docs/specs/auth.md for the reasons behind each value.
 */

/** Refresh token cookie (spec §2.5). */
export const REFRESH_COOKIE_NAME = 'refresh_token';
// The browser only sends the cookie to /api/v1/auth/*, never to other endpoints
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Password hashing (CLAUDE.md Decision #6). */
export const BCRYPT_SALT_ROUNDS = 10;
// bcrypt ignores every byte after the 72nd, so longer passwords are rejected (spec §2.1)
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 8;

/** The only algorithm accepted when verifying a JWT (blocks "alg: none" and algorithm switching). */
export const JWT_ALGORITHM = 'HS256';

/**
 * Error messages returned to the client. Login failures all share INVALID_CREDENTIALS,
 * so the response never reveals whether an email is registered (spec §3.2).
 */
export const AUTH_ERROR = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  EMAIL_ALREADY_REGISTERED: 'Email already registered',
  UNAUTHORIZED: 'Authentication required',
} as const;
