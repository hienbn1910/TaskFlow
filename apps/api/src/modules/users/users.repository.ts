import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma-client/client';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateUserData,
  UpdateProfileData,
  UserCredentials,
  UserEntity,
} from './entities/user.entity';

/**
 * Columns loaded for a UserEntity. `password` is deliberately absent:
 * a query using this select can never return the hash (RULE.md §4 "select only needed fields").
 * `satisfies` makes TypeScript check every key against the real Prisma model.
 */
const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const CREDENTIALS_SELECT = { ...USER_SELECT, password: true } as const satisfies Prisma.UserSelect;

/**
 * Data access for `users`. No business rules here: whether a deleted or inactive user
 * may log in is decided by the service. Not tenant-scoped (users exist before any workspace).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Checks ALL rows, soft-deleted included: `email` is unique across the whole table. */
  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user !== null;
  }

  /** Login: loads the password hash. Soft-deleted rows are returned too (service decides). */
  async findByEmailWithPassword(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({ where: { email }, select: CREDENTIALS_SELECT });
  }

  /** Password change: loads the password hash of a user who is not soft-deleted. */
  async findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: CREDENTIALS_SELECT,
    });
  }

  /** Excludes soft-deleted users. `isActive` is returned so the caller can check it. */
  async findActiveById(id: string): Promise<UserEntity | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    return this.prisma.user.create({ data, select: USER_SELECT });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  /**
   * `data` is copied field by field from the closed UpdateProfileData type.
   * `deletedAt: null` in `where`: a user soft-deleted in the meantime is not updated
   * (Prisma throws P2025, mapped to 404 by the global filter).
   */
  async updateProfile(id: string, data: UpdateProfileData): Promise<UserEntity> {
    return this.prisma.user.update({
      where: { id, deletedAt: null },
      data: { fullName: data.fullName },
      select: USER_SELECT,
    });
  }

  /**
   * Stores the new hash AND deletes every refresh token of the user, in ONE nested write.
   * Prisma runs a nested write in a single transaction: the password can never change
   * while old sessions survive, or the reverse (spec §3.2 steps 4–5).
   * Selects only `id`: nothing about the user, least of all the hash, is read back.
   */
  async updatePasswordAndRevokeSessions(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id, deletedAt: null },
      data: { password: passwordHash, refreshTokens: { deleteMany: {} } },
      select: { id: true },
    });
  }
}
