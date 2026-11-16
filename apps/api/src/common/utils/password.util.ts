import { compare, hash } from 'bcryptjs';

import { BCRYPT_SALT_ROUNDS } from '@common/constants/auth.constant';

/**
 * bcrypt hash (cost 10) of 32 random bytes that were thrown away after hashing:
 * no password can ever match it. Its cost MUST equal BCRYPT_SALT_ROUNDS so that
 * comparing against it takes exactly as long as comparing against a real user's hash.
 * Not a secret: it is exported so a test can check its cost.
 */
export const DUMMY_HASH = '$2b$10$2kMxS8TiXp6BG.lqo/0BS.fWUGhBYeH62KqODtGbO1U3bkwHBO.Ne';

/** Hashes a password with bcrypt. A random salt is generated and stored inside the hash. */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_SALT_ROUNDS);
}

/** Compares a password with a stored bcrypt hash (the salt is read from the hash itself). */
export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}

/**
 * Burns the same CPU time as a real password check, then always fails.
 * Login calls this when the email does not exist. Without it, "unknown email" would answer
 * ~100x faster than "wrong password", and response times would reveal which emails are registered.
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  await compare(plain, DUMMY_HASH);
  return false;
}
