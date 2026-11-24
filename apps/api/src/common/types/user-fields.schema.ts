import { z } from 'zod';

import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@common/constants/auth.constant';
import { sanitizedString } from '@common/utils/sanitize.util';

/**
 * Field rules for a user, shared by the auth module (register, login) and the users module
 * (profile, password). Kept in common/types so neither module imports the other (RULE.md §1).
 */

const MAX_EMAIL_LENGTH = 254; // RFC 5321 limit for a full address
const MAX_FULL_NAME_LENGTH = 100; // matches users.full_name VARCHAR(100)

/**
 * Trim + lowercase BEFORE validating, so " User@Example.COM " and "user@example.com"
 * are the same User (spec §2.1). Every lookup and insert receives the normalized value.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(MAX_EMAIL_LENGTH));

/** HTML stripped + trimmed BEFORE the length check (RULE.md §5). */
export const fullNameSchema = sanitizedString(z.string().min(1).max(MAX_FULL_NAME_LENGTH));

/** bcrypt ignores bytes after the 72nd. Counted in UTF-8 BYTES: "ằ" is 1 character but 3 bytes. */
const fitsBcryptLimit = (value: string): boolean =>
  Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;

const PASSWORD_TOO_LONG = `Must be at most ${String(MAX_PASSWORD_BYTES)} bytes`;

/**
 * A password being CHOSEN (register, change password): full strength policy.
 * Never trimmed: spaces are valid password characters.
 * \p{Lu} (any Unicode uppercase letter) so "Ằ" counts as uppercase, not only A–Z.
 */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Must be at least ${String(MIN_PASSWORD_LENGTH)} characters`)
  .regex(/\p{Lu}/u, 'Must contain an uppercase letter')
  .regex(/\d/, 'Must contain a digit')
  .refine(fitsBcryptLimit, PASSWORD_TOO_LONG);

/**
 * A password being CHECKED against the stored hash (login, current password): no strength
 * rule. The hash decides, not the policy. At login, a policy error would also reveal the
 * rules without telling whether the User exists.
 */
export const passwordInputSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(fitsBcryptLimit, PASSWORD_TOO_LONG);
