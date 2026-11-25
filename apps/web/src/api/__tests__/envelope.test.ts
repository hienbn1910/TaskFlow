import { describe, expect, it } from 'vitest';

import { unwrapEnvelope } from '../http';

/**
 * The exact inverse of the API's `toSuccessResponse` (apps/api/src/common/interceptors):
 * the generated types describe what the controller returns, the wire carries the envelope.
 */
describe('unwrapEnvelope', () => {
  it('should return `data` for a single item', () => {
    const user = { id: 'u1', fullName: 'Hien Bui' };

    expect(unwrapEnvelope({ success: true, data: user })).toEqual(user);
  });

  it('should rebuild { items, meta } for a paginated result', () => {
    const meta = { total: 1, page: 1, limit: 20, totalPages: 1 };

    expect(unwrapEnvelope({ success: true, data: [{ id: 'a' }], meta })).toEqual({
      items: [{ id: 'a' }],
      meta,
    });
  });

  it('should return null when the controller returned nothing', () => {
    expect(unwrapEnvelope({ success: true, data: null })).toBeNull();
  });

  it('should reject a 2xx body that is not the success envelope', () => {
    expect(() => unwrapEnvelope({ id: 'u1' })).toThrow('Unexpected response');
  });
});
