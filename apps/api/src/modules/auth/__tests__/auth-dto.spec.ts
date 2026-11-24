import type { z } from 'zod';

import { authResponseSchema } from '../dto/auth-response.dto';
import { loginSchema } from '../dto/login.dto';
import { registerSchema } from '../dto/register.dto';

const VALID_REGISTER = {
  email: 'hien@example.com',
  password: 'Secret123',
  fullName: 'Hien Nguyen',
};

/** Error messages for one field, so each test can check exactly which rule failed. */
const messagesFor = (schema: z.ZodType, input: unknown, field: string): string[] => {
  const result = schema.safeParse(input);
  if (result.success) {
    return [];
  }
  return result.error.issues.filter((i) => i.path[0] === field).map((i) => i.message);
};

describe('auth DTO schemas', () => {
  describe('email (register and login)', () => {
    it('should trim and lowercase the email', () => {
      const parsed = registerSchema.parse({ ...VALID_REGISTER, email: '  Hien@Example.COM ' });

      expect(parsed.email).toBe('hien@example.com');
    });

    it.each(['not-an-email', '', 'a@', '@b.co'])('should reject "%s"', (email) => {
      expect(messagesFor(registerSchema, { ...VALID_REGISTER, email }, 'email')).not.toEqual([]);
    });

    it('should reject an email longer than 254 characters', () => {
      const email = `${'a'.repeat(64)}@${'b'.repeat(190)}.com`;

      expect(messagesFor(registerSchema, { ...VALID_REGISTER, email }, 'email')).not.toEqual([]);
    });
  });

  describe('password (register)', () => {
    it.each([
      ['Short1', 'Must be at least 8 characters'],
      ['secret123', 'Must contain an uppercase letter'],
      ['SecretPass', 'Must contain a digit'],
    ])('should reject "%s" with "%s"', (password, message) => {
      expect(messagesFor(registerSchema, { ...VALID_REGISTER, password }, 'password')).toContain(
        message,
      );
    });

    it('should accept a non-ASCII uppercase letter (Ằ)', () => {
      expect(registerSchema.safeParse({ ...VALID_REGISTER, password: 'ằngƯời12' }).success).toBe(
        true,
      );
    });

    it('should not trim the password (spaces are valid characters)', () => {
      expect(registerSchema.parse({ ...VALID_REGISTER, password: ' Secret123 ' }).password).toBe(
        ' Secret123 ',
      );
    });

    it('should accept exactly 72 bytes', () => {
      const password = `A1${'a'.repeat(70)}`;

      expect(registerSchema.safeParse({ ...VALID_REGISTER, password }).success).toBe(true);
    });

    it('should reject 73 bytes', () => {
      const password = `A1${'a'.repeat(71)}`;

      expect(messagesFor(registerSchema, { ...VALID_REGISTER, password }, 'password')).toEqual([
        'Must be at most 72 bytes',
      ]);
    });

    it('should count BYTES, not characters: 26 Vietnamese characters can exceed 72 bytes', () => {
      const password = `A1${'ằ'.repeat(24)}`; // 26 characters, 2 + 24 × 3 = 74 bytes

      expect(password).toHaveLength(26);
      expect(messagesFor(registerSchema, { ...VALID_REGISTER, password }, 'password')).toEqual([
        'Must be at most 72 bytes',
      ]);
    });

    it('should count emoji as 4 bytes', () => {
      const password = `A1${'😀'.repeat(18)}`; // 2 + 18 × 4 = 74 bytes

      expect(messagesFor(registerSchema, { ...VALID_REGISTER, password }, 'password')).toEqual([
        'Must be at most 72 bytes',
      ]);
    });
  });

  describe('fullName (register)', () => {
    it('should strip HTML tags and trim', () => {
      const parsed = registerSchema.parse({ ...VALID_REGISTER, fullName: '  <b>Hien</b> ' });

      expect(parsed.fullName).toBe('Hien');
    });

    it('should reject a name that is empty after cleaning', () => {
      const input = { ...VALID_REGISTER, fullName: '<script></script>  ' };

      expect(messagesFor(registerSchema, input, 'fullName')).not.toEqual([]);
    });

    it('should accept 100 characters and reject 101', () => {
      const ok = registerSchema.safeParse({ ...VALID_REGISTER, fullName: 'a'.repeat(100) });
      const tooLong = registerSchema.safeParse({ ...VALID_REGISTER, fullName: 'a'.repeat(101) });

      expect(ok.success).toBe(true);
      expect(tooLong.success).toBe(false);
    });
  });

  describe('unknown fields', () => {
    it('should strip fields that are not in the schema', () => {
      const parsed = registerSchema.parse({ ...VALID_REGISTER, isActive: false, role: 'ADMIN' });

      expect(Object.keys(parsed).sort()).toEqual(['email', 'fullName', 'password']);
    });
  });

  describe('login', () => {
    it('should accept a weak password (no strength rule at login)', () => {
      expect(loginSchema.safeParse({ email: 'a@b.co', password: 'weak' }).success).toBe(true);
    });

    it('should reject an empty password', () => {
      expect(messagesFor(loginSchema, { email: 'a@b.co', password: '' }, 'password')).toEqual([
        'Password is required',
      ]);
    });

    it('should still reject more than 72 bytes', () => {
      const input = { email: 'a@b.co', password: 'a'.repeat(73) };

      expect(messagesFor(loginSchema, input, 'password')).toEqual(['Must be at most 72 bytes']);
    });
  });

  describe('auth response', () => {
    it('should strip a refresh token returned by mistake', () => {
      const parsed = authResponseSchema.parse({
        accessToken: 'access.jwt',
        refreshToken: 'refresh.jwt',
        user: {
          id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
          email: 'hien@example.com',
          fullName: 'Hien',
          avatarUrl: null,
          createdAt: '2026-11-18T08:00:00.000Z',
          password: '$2b$10$hash',
        },
      });

      expect(parsed).not.toHaveProperty('refreshToken');
      expect(parsed.user).not.toHaveProperty('password');
    });
  });
});
