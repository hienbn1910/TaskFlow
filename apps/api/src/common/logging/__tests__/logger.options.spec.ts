import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';

import { buildLoggerOptions } from '../logger.options';

const SECRETS = {
  bearer: 'eyJhbGciOiJIUzI1NiJ9.payload-part.signature-part',
  cookie: 'refresh-cookie-value-123',
  password: 'Secret123',
  currentPassword: 'OldSecret123',
  newPassword: 'NewSecret456',
};

/**
 * A real pino-http logger built from the options, writing to memory, behind a tiny Express app.
 * The route behaves like JwtAuthGuard (sets `req.user` AFTER the middleware) and logs a body.
 * It has a path parameter, so the logged route (template) differs from the URL.
 */
async function logOneRequest(): Promise<string[]> {
  const lines: string[] = [];
  const options = buildLoggerOptions({ nodeEnv: 'production', logLevel: undefined });
  const app = express();
  app.use(pinoHttp(options, { write: (line: string) => lines.push(line) }));
  app.post('/sessions/:id', (req, res) => {
    req.user = { id: 'user-1', email: 'hien@example.com' };
    const { password, currentPassword, newPassword } = SECRETS;
    req.log.info(
      { body: { email: 'hien@example.com', password, currentPassword, newPassword } },
      'body',
    );
    res.setHeader('Set-Cookie', `refresh_token=${SECRETS.cookie}; HttpOnly`);
    res.status(200).send('ok');
  });

  await request(app)
    .post('/sessions/abc-123')
    .set('Authorization', `Bearer ${SECRETS.bearer}`)
    .set('Cookie', `refresh_token=${SECRETS.cookie}`)
    .set('X-Request-Id', '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34');
  return lines;
}

describe('buildLoggerOptions', () => {
  describe('level', () => {
    it.each([
      ['production', 'info'],
      ['development', 'debug'],
      ['test', 'silent'],
    ] as const)('should default to the level of %s: %s', (nodeEnv, level) => {
      expect(buildLoggerOptions({ nodeEnv, logLevel: undefined }).level).toBe(level);
    });

    it('should let LOG_LEVEL override the default', () => {
      expect(buildLoggerOptions({ nodeEnv: 'production', logLevel: 'warn' }).level).toBe('warn');
    });
  });

  describe('format', () => {
    it('should pretty-print in development only', () => {
      const dev = buildLoggerOptions({ nodeEnv: 'development', logLevel: undefined });

      expect(dev.transport).toEqual(expect.objectContaining({ target: 'pino-pretty' }));
    });

    it('should write plain JSON in production (no transport)', () => {
      expect(buildLoggerOptions({ nodeEnv: 'production', logLevel: undefined }).transport).toBe(
        undefined,
      );
    });
  });

  describe('a request logged through these options', () => {
    // RULE.md §5: secrets never reach the logs
    it.each(Object.entries(SECRETS))('should not contain the %s value', async (_name, secret) => {
      const output = (await logOneRequest()).join('');

      expect(output).not.toContain(secret);
    });

    it('should write one request line with the request id, status and User id', async () => {
      const lines = (await logOneRequest()).map((line): unknown => JSON.parse(line));

      expect(lines).toContainEqual(
        expect.objectContaining({
          msg: 'request completed',
          userId: 'user-1',
          route: '/sessions/:id',
          req: expect.objectContaining({ id: '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34' }),
          res: expect.objectContaining({ statusCode: 200 }),
          responseTime: expect.any(Number),
        }),
      );
    });
  });
});
