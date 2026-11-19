import type { z } from 'zod';

import { USER_ERROR } from '@common/constants/user.constant';

import { changePasswordSchema } from '../dto/change-password.dto';
import { updateProfileSchema } from '../dto/update-profile.dto';

const VALID_CHANGE = { currentPassword: 'OldSecret1', newPassword: 'NewSecret2' };

/** Error messages for one field ('' = the whole object), so each test checks which rule failed. */
const messagesFor = (schema: z.ZodType, input: unknown, field: string): string[] => {
  const result = schema.safeParse(input);
  if (result.success) {
    return [];
  }
  return result.error.issues
    .filter((issue) => issue.path.map(String).join('.') === field)
    .map((issue) => issue.message);
};

describe('users DTO schemas', () => {
  describe('updateProfileSchema', () => {
    it('should accept a valid fullName', () => {
      expect(updateProfileSchema.parse({ fullName: 'Hien Nguyen' })).toEqual({
        fullName: 'Hien Nguyen',
      });
    });

    it('should strip HTML and trim the name (same rule as register)', () => {
      expect(updateProfileSchema.parse({ fullName: '  <b>Hien</b> Nguyen ' }).fullName).toBe(
        'Hien Nguyen',
      );
    });

    it('should reject an empty body', () => {
      expect(messagesFor(updateProfileSchema, {}, '')).toEqual([USER_ERROR.NO_FIELDS]);
    });

    it('should reject a body whose fields are all undefined', () => {
      expect(messagesFor(updateProfileSchema, { fullName: undefined }, '')).toEqual([
        USER_ERROR.NO_FIELDS,
      ]);
    });

    it('should reject a body with only unknown fields (they are stripped first)', () => {
      const input = { email: 'evil@example.com', isActive: false, password: 'Hacked123' };

      expect(messagesFor(updateProfileSchema, input, '')).toEqual([USER_ERROR.NO_FIELDS]);
    });

    it('should strip email, isActive and password next to a valid field', () => {
      const input = { fullName: 'Hien', email: 'evil@example.com', isActive: false, password: 'X1' };

      expect(updateProfileSchema.parse(input)).toEqual({ fullName: 'Hien' });
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   '],
      ['only HTML', '<script></script>'],
      ['101 characters', 'a'.repeat(101)],
    ])('should reject a fullName that is %s', (_case, fullName) => {
      expect(messagesFor(updateProfileSchema, { fullName }, 'fullName')).not.toEqual([]);
    });

    it('should accept exactly 100 characters', () => {
      expect(updateProfileSchema.safeParse({ fullName: 'a'.repeat(100) }).success).toBe(true);
    });

    it('should reject a non-string fullName', () => {
      expect(messagesFor(updateProfileSchema, { fullName: 123 }, 'fullName')).not.toEqual([]);
    });
  });

  describe('changePasswordSchema', () => {
    it('should accept a valid body and keep both passwords untouched', () => {
      expect(changePasswordSchema.parse(VALID_CHANGE)).toEqual(VALID_CHANGE);
    });

    it.each([
      ['Short1', 'Must be at least 8 characters'],
      ['newsecret2', 'Must contain an uppercase letter'],
      ['NewSecret', 'Must contain a digit'],
    ])('should reject a weak newPassword "%s" with "%s"', (newPassword, message) => {
      const input = { ...VALID_CHANGE, newPassword };

      expect(messagesFor(changePasswordSchema, input, 'newPassword')).toContain(message);
    });

    it('should reject a newPassword longer than 72 bytes', () => {
      const input = { ...VALID_CHANGE, newPassword: `A1${'ằ'.repeat(24)}` }; // 2 + 72 bytes

      expect(messagesFor(changePasswordSchema, input, 'newPassword')).toEqual([
        'Must be at most 72 bytes',
      ]);
    });

    it('should report the same password on newPassword', () => {
      const input = { currentPassword: 'Secret123', newPassword: 'Secret123' };

      expect(messagesFor(changePasswordSchema, input, 'newPassword')).toEqual([
        USER_ERROR.NEW_PASSWORD_SAME,
      ]);
    });

    it('should treat passwords differing only by case or spaces as different', () => {
      expect(changePasswordSchema.safeParse({ ...VALID_CHANGE, newPassword: 'OLDSECRET1' }).success)
        .toBe(true);
      expect(changePasswordSchema.safeParse({ ...VALID_CHANGE, newPassword: ' OldSecret1' }).success)
        .toBe(true);
    });

    it('should reject an empty or missing currentPassword', () => {
      expect(messagesFor(changePasswordSchema, { ...VALID_CHANGE, currentPassword: '' }, 'currentPassword'))
        .toEqual(['Password is required']);
      expect(messagesFor(changePasswordSchema, { newPassword: 'NewSecret2' }, 'currentPassword'))
        .not.toEqual([]);
    });

    it('should accept a weak currentPassword (no strength rule: the hash decides)', () => {
      expect(changePasswordSchema.safeParse({ ...VALID_CHANGE, currentPassword: 'abc' }).success)
        .toBe(true);
    });

    it('should reject a currentPassword longer than 72 bytes', () => {
      const input = { ...VALID_CHANGE, currentPassword: 'a'.repeat(73) };

      expect(messagesFor(changePasswordSchema, input, 'currentPassword')).toEqual([
        'Must be at most 72 bytes',
      ]);
    });

    it('should strip unknown fields', () => {
      expect(changePasswordSchema.parse({ ...VALID_CHANGE, userId: 'someone-else' })).toEqual(
        VALID_CHANGE,
      );
    });
  });
});
