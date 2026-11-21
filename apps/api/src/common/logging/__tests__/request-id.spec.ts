import { resolveRequestId } from '../request-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('should reuse an incoming UUID unchanged', () => {
    const incoming = '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34';

    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  it('should reuse an incoming UUID written in upper case', () => {
    const incoming = '3F2B8C1E-9D4A-4F6B-8E2C-1A7D5B9C0E34';

    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  // A client-chosen value ends up in every log line: only a UUID is trusted (ADR-0035)
  it.each([
    ['a free-text value', 'abc'],
    ['an injection attempt', "' OR 1=1 --"],
    ['a log-forging attempt', 'x\n{"level":50,"msg":"fake"}'],
    ['an empty value', ''],
    ['a UUID with extra characters', '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34 '],
  ])('should generate a new UUID for %s', (_case, incoming) => {
    const id = resolveRequestId(incoming);

    expect(id).toMatch(UUID_PATTERN);
    expect(id).not.toBe(incoming);
  });

  it('should generate a new UUID when the header is missing', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID_PATTERN);
  });

  it('should generate a new UUID when the header was sent twice (array)', () => {
    const twice = ['3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e34', '3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e35'];

    expect(resolveRequestId(twice)).toMatch(UUID_PATTERN);
    expect(twice).not.toContain(resolveRequestId(twice));
  });

  it('should generate a different id for each request', () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});
