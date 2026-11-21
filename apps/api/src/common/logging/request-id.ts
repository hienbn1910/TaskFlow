import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Canonical UUID: 8-4-4-4-12 hex digits, any version, any case. Anchored: no extra characters. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * The id of one request, written in every log line and returned to the client (ADR-0035).
 * An incoming `X-Request-Id` is reused ONLY if it is a UUID: anything else (free text, newlines
 * that would forge log lines, a header sent twice) is replaced by a fresh UUID.
 */
export function resolveRequestId(header: unknown): string {
  if (typeof header === 'string' && UUID_PATTERN.test(header)) {
    return header;
  }
  return randomUUID();
}

/**
 * pino-http `genReqId`: runs once per request, before any guard or handler. The result becomes
 * `request.id` (read by the exception filter) and is written in every log line of the request.
 * The response header is set here, so it is present on every response, errors included.
 */
export function generateRequestId(request: IncomingMessage, response: ServerResponse): string {
  const id = resolveRequestId(request.headers['x-request-id']);
  response.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/** `request.id` as set by pino-http; undefined if the logging middleware did not run. */
export function requestIdOf(request: { id?: unknown }): string | undefined {
  return typeof request.id === 'string' ? request.id : undefined;
}
