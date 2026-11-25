import { z } from 'zod';

const GENERIC_MESSAGE = 'Something went wrong. Try again.';
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
  const body = errorBodySchema.safeParse(await readJson(response));
  if (!body.success) {
    return new ApiError({ status: response.status, message: GENERIC_MESSAGE });
  }
  const { message, details, requestId } = body.data;
  return new ApiError({ status: response.status, message, details, requestId });
}

/** The parsed JSON body, or undefined when there is none or it is not JSON. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The orval mutator: every generated request function calls it (ADR-0033).
 * Relative URLs keep requests same-origin (Vite proxy, Vercel rewrite: ADR-0020).
 */
export async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: 'same-origin' });
  } catch {
    throw new ApiError({ status: 0, message: NETWORK_MESSAGE });
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  const body = await readJson(response);
  // The generated function states T from openapi.json; the envelope check guards the shape
  return (body === undefined ? undefined : unwrapEnvelope(body)) as T;
}
