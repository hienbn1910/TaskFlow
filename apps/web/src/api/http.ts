import { z } from 'zod';

// A deliberate import cycle (http ↔ session): session.ts uses rawRequest, this file uses
// refreshSession. Safe because both are only called at run time, never while modules load.
import { useAuthStore } from '@/features/auth/auth-store';
import { refreshSession } from '@/features/auth/session';

export const GENERIC_MESSAGE = 'Something went wrong. Try again.';
const NETWORK_MESSAGE = 'Cannot reach the server. Check your connection.';

/**
 * The API's error body (ADR-0001, ADR-0035). Hand-written on purpose: error responses are not in
 * openapi.json, and every endpoint shares this one shape.
 */
const errorBodySchema = z.object({
  success: z.literal(false),
  message: z.string(),
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  requestId: z.string().optional(),
});

/** The success envelope added by the API's ResponseInterceptor (`toSuccessResponse`). */
const successEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: z.unknown().optional(),
});

export type ErrorDetail = { readonly field: string; readonly message: string };

interface ApiErrorInit {
  readonly status: number;
  readonly message: string;
  readonly details?: readonly ErrorDetail[] | undefined;
  readonly requestId?: string | undefined;
}

/** Every failed request rejects with this. `status` 0 = the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: readonly ErrorDetail[] | undefined;
  /** Shown to the User so a report can be matched with the server logs (ADR-0035). */
  readonly requestId: string | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
  }
}

/**
 * The exact inverse of the API's `toSuccessResponse` (plan §3.1): `{ data }` → data,
 * `{ data: items, meta }` → `{ items, meta }`, so the generated types match what callers get.
 */
export function unwrapEnvelope(body: unknown): unknown {
  const envelope = successEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    throw new ApiError({ status: 200, message: 'Unexpected response from the server' });
  }
  const { data, meta } = envelope.data;
  return meta === undefined ? data : { items: data, meta };
}

/** Builds the ApiError of a non-2xx response; a non-standard body (proxy page…) gets a generic message. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body = errorBodySchema.safeParse(parseJson(await response.text()));
  if (!body.success) {
    return new ApiError({ status: response.status, message: GENERIC_MESSAGE });
  }
  const { message, details, requestId } = body.data;
  return new ApiError({ status: response.status, message, details, requestId });
}

/** The parsed JSON, or undefined when the text is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * One fetch. Relative URLs keep requests same-origin (Vite proxy, Vercel rewrite: ADR-0020),
 * so the refresh cookie travels with `credentials: 'same-origin'`.
 */
async function send(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(url, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError({ status: 0, message: NETWORK_MESSAGE });
  }
}

/**
 * One refresh, then one retry (spec §5.1). When the refresh ended the session there is no
 * token to retry with: the original 401 is returned.
 */
async function retryAfterRefresh(
  url: string,
  init: RequestInit,
  unauthorized: Response,
): Promise<Response> {
  await refreshSession();
  const token = useAuthStore.getState().accessToken;
  return token === null ? unauthorized : send(url, init, token);
}

/** The unwrapped data of a 2xx response, or the ApiError of any other. */
async function toResult<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  const text = await response.text();
  // Only an empty body (204) is "no data": a body that is not the JSON envelope (an HTML page
  // from a misrouted rewrite) must fail, not resolve with undefined
  if (text === '') return undefined as T;
  // The generated function states T from openapi.json; the envelope check guards the shape
  return unwrapEnvelope(parseJson(text)) as T;
}

/** The orval mutator: every generated request function calls it (ADR-0033). */
export async function request<T>(url: string, init: RequestInit): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  let response = await send(url, init, token);
  // Only a request sent with a token can have an expired one: a wrong password stays a 401
  if (response.status === 401 && token !== null) {
    response = await retryAfterRefresh(url, init, response);
  }
  return toResult<T>(response);
}

/**
 * For the refresh call only (plan §3.2): no Bearer header and no 401 retry, so a failed
 * refresh can never start another refresh.
 */
export async function rawRequest<T>(url: string, init: RequestInit): Promise<T> {
  return toResult<T>(await send(url, init, null));
}
