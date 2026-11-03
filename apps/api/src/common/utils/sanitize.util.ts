import { z } from 'zod';

const HTML_TAG_REGEX = /<\/?[a-zA-Z!][^>]*>/g;

/** Removes HTML tags. Text content and special characters such as "&" are kept as-is. */
export function stripHtml(value: string): string {
  return value.replace(HTML_TAG_REGEX, '');
}

/**
 * String schema that strips HTML and trims BEFORE validation rules run (RULE.md §5).
 * Usage: `fullName: sanitizedString(z.string().min(1).max(100))`
 * → "  <b>Hien</b> " becomes "Hien", and min/max are checked against the cleaned value.
 */
export function sanitizedString(rules: z.ZodString = z.string()) {
  return z
    .string()
    .transform((value) => stripHtml(value).trim())
    .pipe(rules);
}
