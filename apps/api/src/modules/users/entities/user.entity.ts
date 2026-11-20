/**
 * User as the application sees it: our own type, not the Prisma model (RULE.md §1 entities/).
 * Never contains the password hash; only UserCredentials does, and only login uses it.
 */
export interface UserEntity {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
}

/** UserEntity + bcrypt hash. Returned ONLY by the two credential queries of UsersRepository. */
export interface UserCredentials extends UserEntity {
  readonly password: string;
}

/**
 * Fields a user may change on their own profile. A closed list: the repository never
 * receives the request body, so email, isActive or password cannot be set this way.
 */
export interface UpdateProfileData {
  readonly fullName?: string;
}

/** Data needed to insert a user. `password` must already be a bcrypt hash. */
export interface CreateUserData {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
}
