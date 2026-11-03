import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url().startsWith('postgresql://'),
});

export const databaseConfig = registerAs('database', () => {
  const env = databaseEnvSchema.parse(process.env);
  return { url: env.DATABASE_URL } as const;
});
