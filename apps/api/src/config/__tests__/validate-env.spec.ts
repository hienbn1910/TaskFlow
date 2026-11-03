import { validateEnv } from '../index';

const validEnv = (): Record<string, unknown> => ({
  NODE_ENV: 'test',
  PORT: '3000',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
});

describe('validateEnv', () => {
  it('should accept a valid environment', () => {
    const env = validEnv();
    expect(validateEnv(env)).toBe(env);
  });

  it('should throw listing every invalid variable', () => {
    const env = { ...validEnv(), DATABASE_URL: 'mysql://x', REDIS_URL: undefined };
    expect(() => validateEnv(env)).toThrow(/DATABASE_URL[\s\S]*REDIS_URL/);
  });

  it('should reject JWT secrets shorter than 32 characters', () => {
    const env = { ...validEnv(), JWT_ACCESS_SECRET: 'short' };
    expect(() => validateEnv(env)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('should reject identical access and refresh secrets', () => {
    const env = { ...validEnv(), JWT_REFRESH_SECRET: 'a'.repeat(32) };
    expect(() => validateEnv(env)).toThrow(/must be different/);
  });

  it('should reject an invalid expiry format', () => {
    const env = { ...validEnv(), JWT_ACCESS_EXPIRY: '15 minutes' };
    expect(() => validateEnv(env)).toThrow(/JWT_ACCESS_EXPIRY/);
  });

  it('should never print secret values in the error message', () => {
    const secret = 'super-secret-value';
    const env = { ...validEnv(), JWT_ACCESS_SECRET: secret };

    const run = (): unknown => validateEnv(env);

    expect(run).toThrow(/JWT_ACCESS_SECRET/);
    expect(run).not.toThrow(new RegExp(secret));
  });
});
