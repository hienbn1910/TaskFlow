import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';

import {
  INTERNAL_ERROR_MESSAGE,
  PRISMA_ERROR_STATUS,
  toErrorCode,
} from '@common/constants/error-codes.constant';
import type { ApiErrorResponse, ErrorDetail } from '@common/types/api-response.type';
import { maskSensitiveText } from '@common/utils/mask.util';

interface NormalizedError {
  readonly statusCode: number;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}

const PRISMA_ERROR_MESSAGE: Readonly<Record<string, string>> = {
  P2002: 'Resource already exists',
  P2025: 'Resource not found',
};

/**
 * Catches EVERY error (no argument to @Catch) and converts it into the standard error
 * format (WORKFLOW.md §5). Unknown errors become a generic 500 — the client never sees
 * stack traces, SQL or internal paths; the full detail goes to the server log only.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const normalized = normalizeError(exception);
    this.logError(exception, normalized, request);
    response.status(normalized.statusCode).json(toErrorBody(normalized));
  }

  private logError(exception: unknown, error: NormalizedError, request: Request): void {
    const summary = maskSensitiveText(
      `${request.method} ${request.originalUrl} → ${String(error.statusCode)}`,
    );
    if (error.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(summary, stack);
      return;
    }
    this.logger.warn(`${summary}: ${maskSensitiveText(error.message)}`);
  }
}

export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof ZodValidationException) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      details: toErrorDetails(exception.getZodError()),
    };
  }
  if (exception instanceof HttpException) {
    return { statusCode: exception.getStatus(), message: extractHttpMessage(exception) };
  }
  if (exception instanceof PrismaClientKnownRequestError && exception.code in PRISMA_ERROR_STATUS) {
    return {
      statusCode: PRISMA_ERROR_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
      message: PRISMA_ERROR_MESSAGE[exception.code] ?? INTERNAL_ERROR_MESSAGE,
    };
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_ERROR_MESSAGE };
}

function toErrorBody(error: NormalizedError): ApiErrorResponse {
  return {
    success: false,
    statusCode: error.statusCode,
    error: toErrorCode(error.statusCode),
    message: error.message,
    ...(error.details && error.details.length > 0 ? { details: error.details } : {}),
    timestamp: new Date().toISOString(),
  };
}

/** HttpException.getResponse() can be a string, or an object whose message is a string or string[]. */
function extractHttpMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if ('message' in body) {
    const { message } = body;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.map(String).join(', ');
  }
  return exception.message;
}

interface ZodIssueLike {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

function isZodErrorLike(value: unknown): value is { issues: readonly ZodIssueLike[] } {
  return (
    typeof value === 'object' && value !== null && 'issues' in value && Array.isArray(value.issues)
  );
}

function toErrorDetails(zodError: unknown): ErrorDetail[] {
  if (!isZodErrorLike(zodError)) {
    return [];
  }
  return zodError.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
