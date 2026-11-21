import { credentialsKey } from '../credentials-key';

const IP = '203.0.113.7';

describe('credentialsKey', () => {
  it('should combine the IP with the email', () => {
    expect(credentialsKey(IP, { email: 'hien@example.com' })).toBe('203.0.113.7:hien@example.com');
  });

  // Same normalization as login itself: changing case or adding spaces must not get a new counter
  it.each([' Hien@Example.COM ', 'HIEN@EXAMPLE.COM', 'hien@example.com\t'])(
    'should normalize %p to the same key',
    (email) => {
      expect(credentialsKey(IP, { email })).toBe('203.0.113.7:hien@example.com');
    },
  );

  it('should give two IPs different keys for the same email', () => {
    expect(credentialsKey('198.51.100.1', { email: 'hien@example.com' })).not.toBe(
      credentialsKey(IP, { email: 'hien@example.com' }),
    );
  });

  // No usable email → no per-email limit; the per-IP limit still applies (spec §6.2)
  it.each([
    ['a missing email', {}],
    ['an invalid email', { email: 'not-an-email' }],
    ['a non-string email', { email: 42 }],
    ['an array body', ['hien@example.com']],
    ['a string body', 'hien@example.com'],
    ['no body', undefined],
    ['a null body', null],
  ])('should return undefined for %s', (_case, body) => {
    expect(credentialsKey(IP, body)).toBeUndefined();
  });
});
