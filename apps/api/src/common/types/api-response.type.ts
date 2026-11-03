export interface ErrorDetail {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
  readonly timestamp: string;
}

export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/** Services return this shape for list endpoints; the response interceptor lifts `meta` to the top level. */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly meta: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: PaginationMeta;
}
