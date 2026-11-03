import { maskEmail, maskSensitiveText, maskToken } from '../mask.util';

describe('mask.util', () => {
  describe('maskEmail', () => {
    it('should keep only the first character of the local part', () => {
      expect(maskEmail('hien@gmail.com')).toBe('h***@gmail.com');
    });
  });

  describe('maskToken', () => {
    it('should keep only the first 8 characters', () => {
      expect(maskToken('abcdefghijklmnop')).toBe('abcdefgh***');
    });

    it('should fully mask tokens of 8 characters or less', () => {
      expect(maskToken('abc')).toBe('***');
    });
  });

  describe('maskSensitiveText', () => {
    it('should mask emails and JWTs inside free text', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const text = `login failed for hien@gmail.com with token ${jwt}`;

      const masked = maskSensitiveText(text);

      expect(masked).toContain('h***@gmail.com');
      expect(masked).toContain('eyJhbGci***');
      expect(masked).not.toContain(jwt);
    });

    it('should leave normal text untouched', () => {
      expect(maskSensitiveText('GET /api/v1/health → 200')).toBe('GET /api/v1/health → 200');
    });
  });
});
