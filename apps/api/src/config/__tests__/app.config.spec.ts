import { appEnvSchema } from '../app.config';

const baseEnv = { NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' };

describe('appEnvSchema', () => {
  describe('TRUST_PROXY (number of proxies in front of the API, ADR-0020)', () => {
    it('should default to 0 (trust no proxy)', () => {
      expect(appEnvSchema.parse(baseEnv).TRUST_PROXY).toBe(0);
    });

    it.each([
      ['0', 0],
      ['2', 2],
    ])('should accept the hop count %p', (value, expected) => {
      expect(appEnvSchema.parse({ ...baseEnv, TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
    });

    // `true` would trust any X-Forwarded-For, letting a client fake its IP to escape rate limits
    it.each(['-1', '1.5', 'true', 'false', 'abc', ''])('should reject %p', (value) => {
      expect(appEnvSchema.safeParse({ ...baseEnv, TRUST_PROXY: value }).success).toBe(false);
    });
  });

  describe('LOG_LEVEL', () => {
    it('should be optional (the default depends on NODE_ENV)', () => {
      expect(appEnvSchema.parse(baseEnv).LOG_LEVEL).toBeUndefined();
    });

    it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])(
      'should accept the pino level %p',
      (level) => {
        expect(appEnvSchema.parse({ ...baseEnv, LOG_LEVEL: level }).LOG_LEVEL).toBe(level);
      },
    );

    it.each(['verbose', 'INFO', ''])('should reject %p', (level) => {
      expect(appEnvSchema.safeParse({ ...baseEnv, LOG_LEVEL: level }).success).toBe(false);
    });
  });
});
