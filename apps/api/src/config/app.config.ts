import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

/** pino levels, plus `silent` (no output, used by the test environment). */
export const logLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

export const appEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_URL: z.url(),
  // Number of proxies in front of the API (Express `trust proxy` hop count, ADR-0020).
  // Digits only: z.coerce would turn "" into 0 and "true" would mean "trust every hop".
  TRUST_PROXY: z
    .string()
    .regex(/^\d+$/, 'Must be a non-negative integer (number of proxies)')
    .default('0')
    .transform(Number),
  // Optional: the default depends on NODE_ENV (logger options, spec §7.1)
  LOG_LEVEL: logLevelSchema.optional(),
});

export const appConfig = registerAs('app', () => {
  const env = appEnvSchema.parse(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
    isProduction: env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY,
    logLevel: env.LOG_LEVEL,
  } as const;
});
