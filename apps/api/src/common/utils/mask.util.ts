const TOKEN_VISIBLE_CHARS = 8;
const EMAIL_REGEX = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// JWTs (xxx.yyy.zzz) and long opaque tokens (32+ url-safe chars)
const TOKEN_REGEX = /\b(?:[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g;

/** "hien@gmail.com" → "h***@gmail.com" (RULE.md §5 — Data Exposure) */
export function maskEmail(email: string): string {
  return email.replace(EMAIL_REGEX, '$1***@$2');
}

/** Keeps only the first 8 characters of a token. */
export function maskToken(token: string): string {
  if (token.length <= TOKEN_VISIBLE_CHARS) {
    return '***';
  }
  return `${token.slice(0, TOKEN_VISIBLE_CHARS)}***`;
}

/** Masks every email and token found inside free text (log messages). */
export function maskSensitiveText(text: string): string {
  return maskEmail(text).replace(TOKEN_REGEX, (match) => maskToken(match));
}
