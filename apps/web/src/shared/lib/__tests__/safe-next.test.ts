import { describe, expect, it } from 'vitest';

import { safeNext } from '../safe-next';

/** `?next=` comes from the address bar: anyone can craft it (open redirect, spec §6). */
describe('safeNext', () => {
  it('should keep a path of this app with its query', () => {
    expect(safeNext('/w/1?x=2')).toBe('/w/1?x=2');
  });

  it.each([
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash the browser reads as a slash', '/\\evil.example'],
    ['a tab the browser strips before the slash', '/\t/evil.example'],
    ['a newline the browser strips before the slash', '/\n/evil.example'],
    ['an absolute URL', 'https://evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['an empty value', ''],
    ['no value', null],
  ])('should fall back to / for %s', (_case, value) => {
    expect(safeNext(value)).toBe('/');
  });
});
