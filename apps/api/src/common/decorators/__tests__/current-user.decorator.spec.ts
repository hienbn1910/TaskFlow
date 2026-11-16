import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import type { AuthUser } from '@common/types/auth-user.type';

import { getCurrentUser } from '../current-user.decorator';

// ExecutionContextHost is Nest's real ExecutionContext implementation:
// switchToHttp().getRequest() returns the first argument, so no type cast is needed.
const contextWithRequest = (request: object): ExecutionContextHost =>
  new ExecutionContextHost([request]);

describe('getCurrentUser (@CurrentUser)', () => {
  it('should return the user attached by the guard', () => {
    const user: AuthUser = { id: 'b3f1c2a4-0000-4000-8000-000000000001', email: 'a@b.co' };

    expect(getCurrentUser(undefined, contextWithRequest({ user }))).toBe(user);
  });

  it('should throw 401 when no user is attached', () => {
    const act = (): AuthUser => getCurrentUser(undefined, contextWithRequest({}));

    expect(act).toThrow(UnauthorizedException);
    expect(act).toThrow(AUTH_ERROR.UNAUTHORIZED);
  });
});
