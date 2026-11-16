const DURATION_REGEX = /^(\d+)([smhd])$/;

const UNIT_MS: Readonly<Record<string, number>> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Converts a JWT-style duration ("15m", "7d", "3600s") into milliseconds.
 * Used for the refresh token's `expiresAt` and the cookie `maxAge`, so both match the JWT expiry.
 * jwt.config.ts already validates the format at startup; throwing here is a second guard.
 */
export function parseDurationMs(value: string): number {
  const match = DURATION_REGEX.exec(value);
  const amount = match?.[1];
  const unitMs = match?.[2] === undefined ? undefined : UNIT_MS[match[2]];
  if (amount === undefined || unitMs === undefined) {
    throw new Error(`Invalid duration "${value}". Expected a number followed by s, m, h or d`);
  }
  return Number(amount) * unitMs;
}
