import { serializeOpenApi } from '../openapi-document';

describe('serializeOpenApi', () => {
  // The committed openapi.json is diffed in PRs: the same document must always give the same bytes
  it('should write 2-space JSON in insertion order with a trailing newline', () => {
    expect(serializeOpenApi({ b: 1, a: [1] })).toBe('{\n  "b": 1,\n  "a": [\n    1\n  ]\n}\n');
  });

  it('should give identical output for the same document', () => {
    const document = { openapi: '3.0.0', paths: { '/x': { get: {} } } };
    expect(serializeOpenApi(document)).toBe(serializeOpenApi(structuredClone(document)));
  });
});
