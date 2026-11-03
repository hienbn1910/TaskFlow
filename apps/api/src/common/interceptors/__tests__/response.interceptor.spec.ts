import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { ResponseInterceptor, toSuccessResponse } from '../response.interceptor';

describe('toSuccessResponse', () => {
  it('should wrap a single item', () => {
    expect(toSuccessResponse({ id: '1' })).toEqual({ success: true, data: { id: '1' } });
  });

  it('should lift meta to the top level for paginated results', () => {
    const meta = { total: 1, page: 1, limit: 20, totalPages: 1 };
    expect(toSuccessResponse({ items: [{ id: '1' }], meta })).toEqual({
      success: true,
      data: [{ id: '1' }],
      meta,
    });
  });

  it('should turn undefined into null so data is always present', () => {
    expect(toSuccessResponse(undefined)).toEqual({ success: true, data: null });
  });
});

describe('ResponseInterceptor', () => {
  it('should wrap the value emitted by the handler', async () => {
    const interceptor = new ResponseInterceptor();
    const next: CallHandler<unknown> = { handle: () => of({ ok: true }) };

    const result = await firstValueFrom(interceptor.intercept({} as ExecutionContext, next));

    expect(result).toEqual({ success: true, data: { ok: true } });
  });
});
