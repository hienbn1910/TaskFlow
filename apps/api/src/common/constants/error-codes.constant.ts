import { HttpStatus } from '@nestjs/common';

export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/** Prisma error codes that map to a meaningful HTTP status. */
export const PRISMA_ERROR_STATUS: Readonly<Record<string, HttpStatus>> = {
  P2002: HttpStatus.CONFLICT, // Unique constraint failed
  P2025: HttpStatus.NOT_FOUND, // Record to update/delete not found
};

/** 400 → "BAD_REQUEST", 404 → "NOT_FOUND"... (uses the reverse mapping of the HttpStatus enum) */
export function toErrorCode(status: number): string {
  const name: unknown = HttpStatus[status];
  return typeof name === 'string' ? name : 'UNKNOWN_ERROR';
}
