import { z } from 'zod';

import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@common/constants/auth.constant';

const MAX_EMAIL_LENGTH = 254; // RFC 5321 limit for a full address

/**
 * Trim + lowercase BEFORE validating, so " User@Example.COM " and "user@example.com"
 * are the same account (spec §2.1). Every lookup and insert receives the normalized value.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(MAX_EMAIL_LENGTH));

/** bcrypt ignores bytes after the 72nd. Counted in UTF-8 BYTES: "ằ" is 1 character but 3 bytes. */
const fitsBcryptLimit = (value: string): boolean =>
  Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;

const PASSWORD_TOO_LONG = `Must be at most ${String(MAX_PASSWORD_BYTES)} bytes`;

/**
 * Register: full strength policy. Never trimmed: spaces are valid password characters.
 * \p{Lu} (any Unicode uppercase letter) so "Ằ" counts as uppercase, not only A–Z.
 */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Must be at least ${String(MIN_PASSWORD_LENGTH)} characters`)
  .regex(/\p{Lu}/u, 'Must contain an uppercase letter')
  .regex(/\d/, 'Must contain a digit')
  .refine(fitsBcryptLimit, PASSWORD_TOO_LONG);

/**
 * Login: no strength rule. Accounts are checked against bcrypt, not the policy, and a
 * policy error at login would reveal the rules without telling whether the account exists.
 */
export const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(fitsBcryptLimit, PASSWORD_TOO_LONG);
