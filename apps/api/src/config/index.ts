import { appConfig, appEnvSchema } from './app.config';
import { databaseConfig, databaseEnvSchema } from './database.config';
import { jwtConfig, jwtEnvSchema } from './jwt.config';
import { redisConfig, redisEnvSchema } from './redis.config';

export { appConfig, databaseConfig, jwtConfig, redisConfig };

export const configLoaders = [appConfig, databaseConfig, jwtConfig, redisConfig];

const envSchemas = [appEnvSchema, databaseEnvSchema, jwtEnvSchema, redisEnvSchema];

/**
 * Validates ALL env variables at startup. The app refuses to boot with an invalid config
 * (fail fast) instead of crashing later at the first request that needs the value.
 * Only variable names are printed — never values, which may be secrets.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const issues = envSchemas.flatMap((schema) => {
    const result = schema.safeParse(config);
    return result.success ? [] : result.error.issues;
  });
  if (issues.length > 0) {
    const lines = issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return config;
}
