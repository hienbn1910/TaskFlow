import { isAllowedSecret } from '../jwt.config';

const PLACEHOLDER = 'change-me-access-secret-at-least-32-characters';
const REAL_SECRET = 'x'.repeat(40);

describe('isAllowedSecret', () => {
  it.each(['development', 'test'])('should allow placeholder secrets in %s', (nodeEnv) => {
    expect(isAllowedSecret(nodeEnv, PLACEHOLDER)).toBe(true);
  });

  // 'staging' is not in nodeEnvSchema yet: this proves that a NEW environment
  // is protected by default, without anyone remembering to update this file.
  it.each(['production', 'staging'])('should reject placeholder secrets in %s', (nodeEnv) => {
    expect(isAllowedSecret(nodeEnv, PLACEHOLDER)).toBe(false);
  });

  it.each(['development', 'test', 'production', 'staging'])(
    'should allow a real secret in %s',
    (nodeEnv) => {
      expect(isAllowedSecret(nodeEnv, REAL_SECRET)).toBe(true);
    },
  );
});
