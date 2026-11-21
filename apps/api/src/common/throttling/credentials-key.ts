import { z } from 'zod';

import { emailSchema } from '@common/types/user-fields.schema';

/** Only the field the key needs; any other body content is ignored. */
const loginBodySchema = z.object({ email: emailSchema });

/**
 * Key of the "5 login attempts / min per IP + email" limit (ADR-0031, spec §6.2).
 * The email is normalized by the same `emailSchema` as login itself, so " A@x.com " and
 * "a@x.com" share one counter. Returns undefined when the body has no valid email: the
 * per-IP limit still applies, and the request fails validation anyway.
 * The key holds the raw email: it lives only in the in-memory throttler, never in a log.
 */
export function credentialsKey(ip: string, body: unknown): string | undefined {
  const parsed = loginBodySchema.safeParse(body);
  return parsed.success ? `${ip}:${parsed.data.email}` : undefined;
}
