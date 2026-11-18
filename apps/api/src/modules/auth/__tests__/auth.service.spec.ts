import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { sha256Hex } from '@common/utils/hash.util';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '@common/utils/password.util';
import type { UserCredentials } from '@modules/users/entities/user.entity';
import { UsersRepository } from '@modules/users/users.repository';

import { AuthService } from '../auth.service';
import { RefreshTokenRepository } from '../refresh-token.repository';
import { TokenService } from '../token.service';

// bcrypt is mocked: tests stay fast and can check WHICH comparison ran (real or dummy)
jest.mock('@common/utils/password.util');
const mockedHashPassword = jest.mocked(hashPassword);
const mockedVerifyPassword = jest.mocked(verifyPassword);
const mockedVerifyAgainstDummy = jest.mocked(verifyAgainstDummy);

type UsersMock = jest.Mocked<
  Pick<
    UsersRepository,
    'existsByEmail' | 'findByEmailWithPassword' | 'findActiveById' | 'create' | 'updateLastLogin'
  >
>;
type RefreshTokensMock = jest.Mocked<
  Pick<RefreshTokenRepository, 'create' | 'rotate' | 'deleteByHash' | 'deleteAllForUser'>
>;
type TokensMock = jest.Mocked<
  Pick<TokenService, 'signAccess' | 'signRefresh' | 'verifyRefresh' | 'refreshExpiresAt'>
>;

/** Returns what `action` throws (or undefined if it resolves), so errors can be compared. */
const captureError = async (action: () => Promise<unknown>): Promise<unknown> => {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
};

const EXPIRES_AT = new Date('2026-11-25T08:00:00.000Z');

const USER: UserCredentials = {
  id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
  email: 'hien@example.com',
  fullName: 'Hien Nguyen',
  avatarUrl: null,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-11-18T08:00:00.000Z'),
  password: '$2b$10$storedhash',
};

const PUBLIC_USER = {
  id: USER.id,
  email: USER.email,
  fullName: USER.fullName,
  avatarUrl: null,
  createdAt: '2026-11-18T08:00:00.000Z',
};

describe('AuthService', () => {
  let service: AuthService;
  let users: UsersMock;
  let refreshTokens: RefreshTokensMock;
  let tokens: TokensMock;

  beforeEach(async () => {
    jest.resetAllMocks();
    users = {
      existsByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findActiveById: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    refreshTokens = {
      create: jest.fn(),
      rotate: jest.fn(),
      deleteByHash: jest.fn(),
      deleteAllForUser: jest.fn(),
    };
    tokens = {
      signAccess: jest.fn().mockResolvedValue('access.jwt'),
      signRefresh: jest.fn().mockResolvedValue('refresh.jwt'),
      verifyRefresh: jest.fn(),
      refreshExpiresAt: jest.fn().mockReturnValue(EXPIRES_AT),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: users },
        { provide: RefreshTokenRepository, useValue: refreshTokens },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = { email: 'hien@example.com', password: 'Secret123', fullName: 'Hien Nguyen' };

    it('should reject an email that is already registered with 409', async () => {
      users.existsByEmail.mockResolvedValue(true);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow(AUTH_ERROR.EMAIL_ALREADY_REGISTERED);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('should store the bcrypt hash, never the plain password', async () => {
      users.existsByEmail.mockResolvedValue(false);
      mockedHashPassword.mockResolvedValue('$2b$10$newhash');
      users.create.mockResolvedValue(USER);

      await service.register(dto);

      expect(mockedHashPassword).toHaveBeenCalledWith('Secret123');
      expect(users.create).toHaveBeenCalledWith({
        email: dto.email,
        password: '$2b$10$newhash',
        fullName: dto.fullName,
      });
    });

    it('should start a session and return the public user', async () => {
      users.existsByEmail.mockResolvedValue(false);
      users.create.mockResolvedValue(USER);

      const session = await service.register(dto);

      expect(session).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'refresh.jwt',
        user: PUBLIC_USER,
      });
    });
  });

  describe('login', () => {
    const dto = { email: 'hien@example.com', password: 'Secret123' };

    it('should log in with correct credentials and update lastLoginAt', async () => {
      users.findByEmailWithPassword.mockResolvedValue(USER);
      mockedVerifyPassword.mockResolvedValue(true);

      const session = await service.login(dto);

      expect(mockedVerifyPassword).toHaveBeenCalledWith('Secret123', USER.password);
      expect(users.updateLastLogin).toHaveBeenCalledWith(USER.id);
      expect(session.user).toEqual(PUBLIC_USER);
    });

    it('should run the dummy bcrypt check when the email is unknown', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockedVerifyAgainstDummy).toHaveBeenCalledWith('Secret123');
      expect(mockedVerifyPassword).not.toHaveBeenCalled();
    });

    it.each([
      ['inactive', { ...USER, isActive: false }],
      ['soft-deleted', { ...USER, deletedAt: new Date() }],
    ])('should still run bcrypt for a %s user before rejecting (same timing)', async (_, user) => {
      users.findByEmailWithPassword.mockResolvedValue(user);
      mockedVerifyPassword.mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockedVerifyPassword).toHaveBeenCalledTimes(1);
      expect(users.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should give the IDENTICAL error for all four failure cases', async () => {
      const cases: (() => void)[] = [
        () => users.findByEmailWithPassword.mockResolvedValue(null),
        () => {
          users.findByEmailWithPassword.mockResolvedValue(USER);
          mockedVerifyPassword.mockResolvedValue(false);
        },
        () => {
          users.findByEmailWithPassword.mockResolvedValue({ ...USER, isActive: false });
          mockedVerifyPassword.mockResolvedValue(true);
        },
        () => {
          users.findByEmailWithPassword.mockResolvedValue({ ...USER, deletedAt: new Date() });
          mockedVerifyPassword.mockResolvedValue(true);
        },
      ];

      const errors: unknown[] = [];
      for (const arrange of cases) {
        arrange();
        errors.push(await captureError(async () => service.login(dto)));
      }

      for (const error of errors) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error).toHaveProperty('message', AUTH_ERROR.INVALID_CREDENTIALS);
      }
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('session (shared by register and login)', () => {
    it('should store the SHA-256 of the refresh token, not the token itself', async () => {
      users.findByEmailWithPassword.mockResolvedValue(USER);
      mockedVerifyPassword.mockResolvedValue(true);

      await service.login({ email: USER.email, password: 'Secret123' });

      expect(refreshTokens.create).toHaveBeenCalledWith({
        userId: USER.id,
        tokenHash: sha256Hex('refresh.jwt'),
        expiresAt: EXPIRES_AT,
      });
    });

    it('should never return the password hash', async () => {
      users.findByEmailWithPassword.mockResolvedValue(USER);
      mockedVerifyPassword.mockResolvedValue(true);

      const session = await service.login({ email: USER.email, password: 'Secret123' });

      expect(JSON.stringify(session)).not.toContain(USER.password);
    });
  });

  describe('refresh', () => {
    const OLD_TOKEN = 'old.refresh.jwt';
    const PAYLOAD = { sub: USER.id, jti: '9d2e4f6a-1b3c-4d5e-8f7a-0b1c2d3e4f5a' };

    const arrangeValidToken = (): void => {
      tokens.verifyRefresh.mockResolvedValue(PAYLOAD);
      users.findActiveById.mockResolvedValue(USER);
    };

    it('should rotate: consume the old hash and store the new one', async () => {
      arrangeValidToken();
      refreshTokens.rotate.mockResolvedValue(true);

      const session = await service.refresh(OLD_TOKEN);

      expect(refreshTokens.rotate).toHaveBeenCalledWith(sha256Hex(OLD_TOKEN), {
        userId: USER.id,
        tokenHash: sha256Hex('refresh.jwt'),
        expiresAt: EXPIRES_AT,
      });
      expect(session).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'refresh.jwt',
        user: PUBLIC_USER,
      });
      expect(refreshTokens.deleteAllForUser).not.toHaveBeenCalled();
    });

    it('should revoke ALL sessions of the user when the token was already used', async () => {
      arrangeValidToken();
      refreshTokens.rotate.mockResolvedValue(false);

      await expect(service.refresh(OLD_TOKEN)).rejects.toThrow(AUTH_ERROR.INVALID_REFRESH_TOKEN);
      expect(refreshTokens.deleteAllForUser).toHaveBeenCalledWith(USER.id);
    });

    it.each([undefined, ''])('should throw 401 without touching the DB for token %p', async (token) => {
      await expect(service.refresh(token)).rejects.toThrow(AUTH_ERROR.INVALID_REFRESH_TOKEN);
      expect(tokens.verifyRefresh).not.toHaveBeenCalled();
      expect(users.findActiveById).not.toHaveBeenCalled();
    });

    it('should propagate the 401 of an invalid JWT without touching the DB', async () => {
      tokens.verifyRefresh.mockRejectedValue(
        new UnauthorizedException(AUTH_ERROR.INVALID_REFRESH_TOKEN),
      );

      await expect(service.refresh(OLD_TOKEN)).rejects.toThrow(UnauthorizedException);
      expect(users.findActiveById).not.toHaveBeenCalled();
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });

    it.each([
      ['missing', null],
      ['inactive', { ...USER, isActive: false }],
    ])('should throw 401 and not rotate when the user is %s', async (_, user) => {
      tokens.verifyRefresh.mockResolvedValue(PAYLOAD);
      users.findActiveById.mockResolvedValue(user);

      await expect(service.refresh(OLD_TOKEN)).rejects.toThrow(AUTH_ERROR.INVALID_REFRESH_TOKEN);
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should delete the session by the token hash', async () => {
      await service.logout('some.refresh.jwt');

      expect(refreshTokens.deleteByHash).toHaveBeenCalledWith(sha256Hex('some.refresh.jwt'));
    });

    it.each([undefined, ''])('should do nothing and not throw for token %p', async (token) => {
      await expect(service.logout(token)).resolves.toBeUndefined();
      expect(refreshTokens.deleteByHash).not.toHaveBeenCalled();
    });

    it('should not check the JWT signature', async () => {
      await service.logout('not-even-a-jwt');

      expect(tokens.verifyRefresh).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return the public user', async () => {
      users.findActiveById.mockResolvedValue(USER);

      await expect(service.getProfile(USER.id)).resolves.toEqual(PUBLIC_USER);
    });

    it.each([
      ['missing', null],
      ['inactive', { ...USER, isActive: false }],
    ])('should throw 401 when the user is %s', async (_, user) => {
      users.findActiveById.mockResolvedValue(user);

      await expect(service.getProfile(USER.id)).rejects.toThrow(AUTH_ERROR.UNAUTHORIZED);
    });
  });
});
