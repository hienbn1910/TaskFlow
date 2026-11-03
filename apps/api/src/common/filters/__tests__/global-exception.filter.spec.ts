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
});
