import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test } from '@nestjs/testing';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { Public } from '@common/decorators/public.decorator';
import type { AuthUser } from '@common/types/auth-user.type';
import { TokenService } from '@modules/auth/token.service';
import type { UserEntity } from '@modules/users/entities/user.entity';
import { UsersRepository } from '@modules/users/users.repository';

import { extractBearerToken, JwtAuthGuard } from '../jwt-auth.guard';

// Real decorators on a fake controller: the guard reads them through the real Reflector
class FakeController {
  protectedRoute(): void {}

  @Public()
  publicRoute(): void {}
}

@Public()
class FakePublicController {
  anyRoute(): void {}
}

interface FakeRequest {
  headers: { authorization?: string };
  user?: AuthUser;
}

const contextFor = (
  request: FakeRequest,
  controller: new () => object,
  handler: () => void,
): ExecutionContextHost => new ExecutionContextHost([request], controller, handler);

const USER: UserEntity = {
  id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
  email: 'hien@example.com',
  fullName: 'Hien Nguyen',
  avatarUrl: null,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-11-18T08:00:00.000Z'),
};

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['bearer abc.def.ghi', 'abc.def.ghi'],
  ])('should extract the token from "%s"', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'Bearer a b', 'abc.def.ghi'])(
    'should return null for %p',
    (header) => {
      expect(extractBearerToken(header)).toBeNull();
    },
  );
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let tokens: jest.Mocked<Pick<TokenService, 'verifyAccess'>>;
  let users: jest.Mocked<Pick<UsersRepository, 'findActiveById'>>;

  beforeEach(async () => {
    tokens = { verifyAccess: jest.fn() };
    users = { findActiveById: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: TokenService, useValue: tokens },
        { provide: UsersRepository, useValue: users },
      ],
    }).compile();
    guard = moduleRef.get(JwtAuthGuard);
  });

  const protectedContext = (request: FakeRequest): ExecutionContextHost =>
    contextFor(request, FakeController, FakeController.prototype.protectedRoute);

  describe('public routes', () => {
    it('should allow a @Public() method without checking any token', async () => {
      const context = contextFor({ headers: {} }, FakeController, FakeController.prototype.publicRoute);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(tokens.verifyAccess).not.toHaveBeenCalled();
    });

    it('should allow every method of a @Public() controller', async () => {
      const context = contextFor(
        { headers: {} },
        FakePublicController,
        FakePublicController.prototype.anyRoute,
      );

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('protected routes', () => {
    it('should attach { id, email } to the request for a valid token', async () => {
      tokens.verifyAccess.mockResolvedValue({ sub: USER.id });
      users.findActiveById.mockResolvedValue(USER);
      const request: FakeRequest = { headers: { authorization: 'Bearer valid.access.jwt' } };

      await expect(guard.canActivate(protectedContext(request))).resolves.toBe(true);
      expect(tokens.verifyAccess).toHaveBeenCalledWith('valid.access.jwt');
      expect(request.user).toEqual({ id: USER.id, email: USER.email });
    });

    it.each([undefined, 'Basic dXNlcjpwYXNz', 'Bearer '])(
      'should throw 401 without verifying for header %p',
      async (authorization) => {
        const request: FakeRequest = { headers: { authorization } };

        await expect(guard.canActivate(protectedContext(request))).rejects.toThrow(
          AUTH_ERROR.UNAUTHORIZED,
        );
        expect(tokens.verifyAccess).not.toHaveBeenCalled();
      },
    );

    it('should propagate the 401 of an invalid or expired token', async () => {
      tokens.verifyAccess.mockRejectedValue(new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED));
      const request: FakeRequest = { headers: { authorization: 'Bearer expired.jwt' } };

      await expect(guard.canActivate(protectedContext(request))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(users.findActiveById).not.toHaveBeenCalled();
    });

    it.each([
      ['deleted (not found by findActiveById)', null],
      ['inactive', { ...USER, isActive: false }],
    ])('should throw 401 when the user is %s', async (_, user) => {
      tokens.verifyAccess.mockResolvedValue({ sub: USER.id });
      users.findActiveById.mockResolvedValue(user);
      const request: FakeRequest = { headers: { authorization: 'Bearer valid.access.jwt' } };

      await expect(guard.canActivate(protectedContext(request))).rejects.toThrow(
        AUTH_ERROR.UNAUTHORIZED,
      );
      expect(request.user).toBeUndefined();
    });
  });
});
