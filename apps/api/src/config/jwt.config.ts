import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import { nodeEnvSchema } from './app.config';

const MIN_SECRET_LENGTH = 32;
// Prefix of the sample secrets in .env.example. Those values are public (committed to GitHub).
const PLACEHOLDER_SECRET_PREFIX = 'change-me';
// Allowlist, not blocklist: any environment added later (e.g. staging) rejects
// the sample secrets by default (fail closed).
const PLACEHOLDER_ALLOWED_ENVS: readonly string[] = ['development', 'test'];
const PLACEHOLDER_SECRET_MESSAGE = 'Placeholder secret is only allowed in development and test';
// Format accepted by jsonwebtoken: "15m", "7d", "3600s"...
const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Must look like 15m, 7d, 3600s');

/**
 * Sample secrets are accepted only in the allowlisted environments, so a fresh clone
 * runs with .env.example as-is. Everywhere else the secret must be a real one.
 */
export function isAllowedSecret(nodeEnv: string, secret: string): boolean {
  return (
    PLACEHOLDER_ALLOWED_ENVS.includes(nodeEnv) || !secret.startsWith(PLACEHOLDER_SECRET_PREFIX)
  );
}

export const jwtEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_EXPIRY: durationSchema.default('15m'),
    JWT_REFRESH_EXPIRY: durationSchema.default('7d'),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    path: ['JWT_REFRESH_SECRET'],
  })
  .refine((env) => isAllowedSecret(env.NODE_ENV, env.JWT_ACCESS_SECRET), {
    message: PLACEHOLDER_SECRET_MESSAGE,
    path: ['JWT_ACCESS_SECRET'],
  })
  .refine((env) => isAllowedSecret(env.NODE_ENV, env.JWT_REFRESH_SECRET), {
    message: PLACEHOLDER_SECRET_MESSAGE,
    path: ['JWT_REFRESH_SECRET'],
  });

export const jwtConfig = registerAs('jwt', () => {
  const env = jwtEnvSchema.parse(process.env);
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  } as const;
});
