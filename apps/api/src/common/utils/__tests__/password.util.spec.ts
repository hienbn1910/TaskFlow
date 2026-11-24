import { getRounds } from 'bcryptjs';

import { BCRYPT_SALT_ROUNDS } from '@common/constants/auth.constant';

import { DUMMY_HASH, hashPassword, verifyAgainstDummy, verifyPassword } from '../password.util';

describe('password.util', () => {
  const PASSWORD = 'Secret123';

  describe('hashPassword', () => {
    it('should return a bcrypt hash, never the plain text', async () => {
      const passwordHash = await hashPassword(PASSWORD);

      expect(passwordHash).not.toContain(PASSWORD);
      expect(passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('should use the configured cost factor', async () => {
      expect(getRounds(await hashPassword(PASSWORD))).toBe(BCRYPT_SALT_ROUNDS);
    });

    it('should give different hashes for the same password (random salt)', async () => {
      const [first, second] = [await hashPassword(PASSWORD), await hashPassword(PASSWORD)];

      expect(first).not.toBe(second);
    });
  });

  describe('verifyPassword', () => {
    it('should accept the correct password', async () => {
      const passwordHash = await hashPassword(PASSWORD);

      await expect(verifyPassword(PASSWORD, passwordHash)).resolves.toBe(true);
    });

    it('should reject a wrong password', async () => {
      const passwordHash = await hashPassword(PASSWORD);

      await expect(verifyPassword('Secret124', passwordHash)).resolves.toBe(false);
    });

    it('should be case-sensitive', async () => {
      const passwordHash = await hashPassword(PASSWORD);

      await expect(verifyPassword('secret123', passwordHash)).resolves.toBe(false);
    });
  });

  describe('verifyAgainstDummy', () => {
    it.each(['', PASSWORD, 'anything-at-all'])(
      'should always return false for "%s"',
      async (input) => {
        await expect(verifyAgainstDummy(input)).resolves.toBe(false);
      },
    );

    it('should use the same cost as real hashes, so timing matches', () => {
      expect(getRounds(DUMMY_HASH)).toBe(BCRYPT_SALT_ROUNDS);
    });
  });
});
