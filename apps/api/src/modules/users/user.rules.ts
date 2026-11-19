import type { UserEntity } from './entities/user.entity';

/**
 * Business rules about a user, as pure functions (no DB, no Nest).
 * They live in the users module so auth (service + guard) and users (password change)
 * share one definition, and the dependency keeps pointing auth → users.
 */

/** A user may sign in (or keep using a token) only if active and not soft-deleted. */
export function canSignIn(user: UserEntity): boolean {
  return user.isActive && user.deletedAt === null;
}
