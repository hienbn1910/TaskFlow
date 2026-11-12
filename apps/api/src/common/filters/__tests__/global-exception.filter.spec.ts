import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';

import { GlobalExceptionFilter, normalizeError } from '../global-exception.filter';

const prismaError = (code: string): PrismaClientKnownRequestError =>
  new PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

const createHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/auth/login' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost; // Partial mock — only the methods the filter uses
  return { host, status, json };
};

describe('normalizeError', () => {
  it('should map ZodValidationException to 400 with field details', () => {
    const result = z.object({ email: z.email() }).safeParse({ email: 'bad' });
    const exception = new ZodValidationException(result.error);

    const normalized = normalizeError(exception);

    expect(normalized.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(normalized.details).toEqual([{ field: 'email', message: expect.any(String) }]);
  });

  it('should keep status and message of HttpException', () => {
    expect(normalizeError(new NotFoundException('Workspace not found'))).toEqual({
      statusCode: 404,
      message: 'Workspace not found',
    });
  });

  it('should join array messages from HttpException', () => {
    const exception = new BadRequestException({ message: ['a is required', 'b is required'] });
    expect(normalizeError(exception).message).toBe('a is required, b is required');
  });

  it('should map Prisma P2002 to 409 and P2025 to 404', () => {
    expect(normalizeError(prismaError('P2002')).statusCode).toBe(HttpStatus.CONFLICT);
    expect(normalizeError(prismaError('P2025')).statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('should hide details of unknown Prisma errors behind a generic 500', () => {
    expect(normalizeError(prismaError('P1001'))).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  it('should hide details of unknown errors behind a generic 500', () => {
    const normalized = normalizeError(new Error('SELECT * FROM users failed at /src/x.ts'));
    expect(normalized).toEqual({ statusCode: 500, message: 'Internal server error' });
  });
});

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('should write the standard error body', () => {
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Not here'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Not here',
      timestamp: expect.any(String),
    });
  });

  it('should log 5xx errors with stack and 4xx as warnings', () => {
    const { host } = createHost();

    filter.catch(new Error('boom'), host);
    filter.catch(new BadRequestException('bad'), host);

    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
  });

  it('should never put the stack trace in the response body', () => {
    const { host, json } = createHost();

    filter.catch(new Error('secret internal detail'), host);

    expect(JSON.stringify(json.mock.calls)).not.toContain('secret internal detail');
  });

  describe('masking sensitive data in 5xx logs', () => {
    const EMAIL = 'hien@gmail.com';
    const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';

    /** Second argument passed to logger.error: the stack (or its replacement). */
    const loggedStack = (): unknown => jest.mocked(Logger.prototype.error).mock.calls[0]?.[1];

    it('should mask emails and tokens in the stack trace', () => {
      const { host } = createHost();

      filter.catch(new Error(`Failed to email ${EMAIL} with token ${TOKEN}`), host);

      expect(loggedStack()).toEqual(expect.stringContaining('h***@gmail.com'));
      expect(loggedStack()).toEqual(expect.stringContaining('eyJhbGci***'));
      expect(loggedStack()).toEqual(expect.not.stringContaining(EMAIL));
      expect(loggedStack()).toEqual(expect.not.stringContaining(TOKEN));
    });

    it('should fall back to the masked message when the error has no stack', () => {
      const { host } = createHost();
      const error = new Error(`Failed to email ${EMAIL}`);
      error.stack = undefined;

      filter.catch(error, host);

      expect(loggedStack()).toBe('Failed to email h***@gmail.com');
    });

    it('should mask values thrown without an Error object', () => {
      const { host } = createHost();

      filter.catch(`Failed to email ${EMAIL}`, host);

      expect(loggedStack()).toBe('Failed to email h***@gmail.com');
    });
  });
});
