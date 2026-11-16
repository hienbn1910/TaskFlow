import { createHash } from 'node:crypto';

/**
 * SHA-256 of a string, as 64 lowercase hex characters.
 * Used to store refresh tokens: the DB keeps only the hash (CLAUDE.md Decision #5),
 * so a leaked database does not give anyone a usable token.
 *
 * SHA-256 (fast) is fine here, unlike for passwords: a refresh token is a long random JWT,
 * so it cannot be guessed by brute force. Passwords are short and human-chosen → bcrypt.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
