import { userResponseSchema } from '@common/types/user-response.dto';

import type { UserCredentials } from '../entities/user.entity';
import { toUserResponse } from '../mappers/user.mapper';

describe('toUserResponse', () => {
  // A UserCredentials is also a UserEntity: passing one proves the hash is dropped
  // even if a caller hands the mapper the object returned by login's query.
  const user: UserCredentials = {
    id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
    email: 'hien@example.com',
    fullName: 'Hien Nguyen',
    avatarUrl: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2026-11-17T08:00:00.000Z'),
    password: '$2b$10$somebcrypthash',
  };

  it('should keep exactly the public fields', () => {
    expect(toUserResponse(user)).toEqual({
      id: user.id,
      email: 'hien@example.com',
      fullName: 'Hien Nguyen',
      avatarUrl: null,
      createdAt: '2026-11-17T08:00:00.000Z',
    });
  });

  it('should never include password, isActive or deletedAt', () => {
    const keys = Object.keys(toUserResponse(user));

    expect(keys).not.toContain('password');
    expect(keys).not.toContain('isActive');
    expect(keys).not.toContain('deletedAt');
  });

  it('should produce a value that passes the response schema', () => {
    expect(userResponseSchema.safeParse(toUserResponse(user)).success).toBe(true);
  });
});
