import { sha256Hex } from '../hash.util';

describe('hash.util', () => {
  describe('sha256Hex', () => {
    it('should match the standard SHA-256 test vector', () => {
      // FIPS 180-2 test vector for "abc"
      expect(sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it('should be deterministic', () => {
      expect(sha256Hex('some.jwt.token')).toBe(sha256Hex('some.jwt.token'));
    });

    it('should give different hashes for different inputs', () => {
      expect(sha256Hex('token-a')).not.toBe(sha256Hex('token-b'));
    });

    it('should return 64 lowercase hex characters', () => {
      expect(sha256Hex('anything')).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
