/**
 * The orval mutator: every generated request function calls `request`.
 * W1 minimal version (fetch + JSON) so the generated code compiles; the envelope, ApiError and
 * the 401 refresh come in W2–W3.
 */
export async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin' });
  // The generated function states the response type from openapi.json (ADR-0033)
  return (await response.json()) as T;
}
