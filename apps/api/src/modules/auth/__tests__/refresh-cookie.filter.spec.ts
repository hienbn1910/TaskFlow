import { Logger, UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';

import { RefreshCookieService } from '@common/cookies/refresh-cookie.service';
import { AUTH_ERROR } from '@common/constants/auth.constant';

import { RefreshCookieFilter } from '../filters/refresh-cookie.filter';

/**
 * The filter only has to call RefreshCookieService.clear and then behave like the global
 * filter. The exact cookie attributes are tested with the service (common/cookies).
 */
describe('RefreshCookieFilter', () => {
  let filter: RefreshCookieFilter;
  let cookies: jest.Mocked<Pick<RefreshCookieService, 'clear'>>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    cookies = { clear: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [RefreshCookieFilter, { provide: RefreshCookieService, useValue: cookies }],
    }).compile();
    filter = moduleRef.get(RefreshCookieFilter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createResponse = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { status, json };
  };

  const hostFor = (response: ReturnType<typeof createResponse>): ExecutionContextHost =>
    new ExecutionContextHost([{ method: 'POST', originalUrl: '/api/v1/auth/refresh' }, response]);

  it('should clear the refresh cookie on the response', () => {
    const response = createResponse();

    filter.catch(new UnauthorizedException(), hostFor(response));

    expect(cookies.clear).toHaveBeenCalledWith(response);
  });

  it('should still send the standard error body', () => {
    const response = createResponse();

    filter.catch(new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN), hostFor(response));

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: AUTH_ERROR.INVALID_REFRESH_TOKEN,
      timestamp: expect.any(String),
    });
  });
});
