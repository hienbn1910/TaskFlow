import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const redisEnvSchema = z.object({
  REDIS_URL: z.url().regex(/^rediss?:\/\//, 'Must start with redis:// or rediss://'),
});

export const redisConfig = registerAs('redis', () => {
  const env = redisEnvSchema.parse(process.env);
  return { url: env.REDIS_URL } as const;
});
