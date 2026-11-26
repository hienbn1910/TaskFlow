/** ASCII control characters: browsers drop tabs and newlines from URLs before parsing them. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * The `?next=` target after sign-in, or `/` when it could leave the app (spec §6). Only a path
 * of this origin is kept: it starts with one `/`, not `//` or `/\` (both read as another host),
 * and has no control character (`/\t/evil.example` becomes `//evil.example` in the browser).
 */
export function safeNext(value: string | null): string {
  if (value === null || !value.startsWith('/') || CONTROL_CHARACTERS.test(value)) return '/';
  const second = value.charAt(1);
  return second === '/' || second === '\\' ? '/' : value;
}
