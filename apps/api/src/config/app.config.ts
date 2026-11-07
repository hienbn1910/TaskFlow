import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const appEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_URL: z.url(),
});

export const appConfig = registerAs('app', () => {
  const env = appEnvSchema.parse(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
    isProduction: env.NODE_ENV === 'production',
  } as const;
});
