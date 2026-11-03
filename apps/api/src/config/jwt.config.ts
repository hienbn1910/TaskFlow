import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;
// Format accepted by jsonwebtoken: "15m", "7d", "3600s"...
const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Must look like 15m, 7d, 3600s');

export const jwtEnvSchema = z
  .object({
    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_EXPIRY: durationSchema.default('15m'),
    JWT_REFRESH_EXPIRY: durationSchema.default('7d'),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
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
