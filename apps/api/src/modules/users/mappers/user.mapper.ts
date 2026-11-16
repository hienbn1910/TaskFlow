import type { UserResponse } from '@common/types/user-response.dto';

import type { UserEntity } from '../entities/user.entity';

/**
 * Entity → public response. Fields are copied one by one (no spread), so a field added
 * to UserEntity later is NOT exposed unless someone adds it here on purpose.
 */
export function toUserResponse(user: UserEntity): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
