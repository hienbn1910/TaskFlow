import type { UserEntity } from '../entities/user.entity';
import { canSignIn } from '../user.rules';

describe('canSignIn', () => {
  const activeUser: UserEntity = {
    id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
    email: 'hien@example.com',
    fullName: 'Hien Nguyen',
    avatarUrl: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2026-11-17T08:00:00.000Z'),
  };

  it('should allow an active, not deleted user', () => {
    expect(canSignIn(activeUser)).toBe(true);
  });

  it('should reject an inactive (blocked) user', () => {
    expect(canSignIn({ ...activeUser, isActive: false })).toBe(false);
  });

  it('should reject a soft-deleted user, even if still marked active', () => {
    expect(canSignIn({ ...activeUser, deletedAt: new Date('2026-11-18T08:00:00.000Z') })).toBe(
      false,
    );
  });
});
