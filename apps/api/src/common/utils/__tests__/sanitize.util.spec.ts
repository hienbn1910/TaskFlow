import { z } from 'zod';

import { sanitizedString, stripHtml } from '../sanitize.util';

describe('sanitize.util', () => {
  describe('stripHtml', () => {
    it('should remove tags but keep their text content', () => {
      expect(stripHtml('<b>Hello</b> <script>x</script>')).toBe('Hello x');
    });

    it('should keep special characters that are not tags', () => {
      expect(stripHtml('Tom & Jerry, 1 < 2')).toBe('Tom & Jerry, 1 < 2');
    });
  });

  describe('sanitizedString', () => {
    it('should strip HTML and trim whitespace', () => {
      expect(sanitizedString().parse('  <i>Hien</i>  ')).toBe('Hien');
    });

    it('should apply rules to the CLEANED value', () => {
      const schema = sanitizedString(z.string().min(1));
      // "<b></b>   " is non-empty raw, but empty after cleaning → must fail
      expect(schema.safeParse('<b></b>   ').success).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(sanitizedString().safeParse(123).success).toBe(false);
    });
  });
});
