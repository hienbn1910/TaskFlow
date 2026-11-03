import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

import type { ApiSuccessResponse, PaginatedResult } from '@common/types/api-response.type';

/**
 * Wraps every successful response into the standard format (WORKFLOW.md §5):
 *   single item → { success: true, data }
 *   paginated   → { success: true, data: items, meta }
 * Controllers just return the data; they never build the envelope themselves.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<unknown, ApiSuccessResponse<unknown>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(map((result) => toSuccessResponse(result)));
  }
}

export function toSuccessResponse(result: unknown): ApiSuccessResponse<unknown> {
  if (isPaginatedResult(result)) {
    return { success: true, data: result.items, meta: result.meta };
  }
  return { success: true, data: result ?? null };
}

function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value &&
    Array.isArray(value.items)
  );
}
