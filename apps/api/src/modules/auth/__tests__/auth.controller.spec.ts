import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import type { AuthSession } from '../entities/auth-session.entity';
import { RefreshCookieService } from '../refresh-cookie.service';

const USER = {
  id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f',
  email: 'hien@example.com',
  fullName: 'Hien Nguyen',
  avatarUrl: null,
  createdAt: '2026-11-18T08:00:00.000Z',
};

const SESSION: AuthSession = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt', user: USER };

// Opaque placeholders: the controller only forwards them to the mocked RefreshCookieService,
// so no Express method is ever called on them in these tests.
const REQUEST = {} as Request;
const RESPONSE = {} as Response;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'register' | 'login' | 'refresh' | 'logout' | 'getProfile'>
  >;
  let cookies: jest.Mocked<Pick<RefreshCookieService, 'read' | 'set' | 'clear'>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(SESSION),
      login: jest.fn().mockResolvedValue(SESSION),
      refresh: jest.fn().mockResolvedValue(SESSION),
      logout: jest.fn(),
      getProfile: jest.fn().mockResolvedValue(USER),
    };
    cookies = { read: jest.fn().mockReturnValue('old.refresh.jwt'), set: jest.fn(), clear: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: RefreshCookieService, useValue: cookies },
      ],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  describe.each([
    ['register', async () => controller.register(
      { email: USER.email, password: 'Secret123', fullName: USER.fullName },
      RESPONSE,
    )],
    ['login', async () => controller.login({ email: USER.email, password: 'Secret123' }, RESPONSE)],
    ['refresh', async () => controller.refresh(REQUEST, RESPONSE)],
  ])('%s', (_, call) => {
    it('should put the refresh token in the cookie', async () => {
      await call();

      expect(cookies.set).toHaveBeenCalledWith(RESPONSE, 'refresh.jwt');
    });

    it('should return only { accessToken, user }, never the refresh token', async () => {
      const body = await call();

      expect(body).toEqual({ accessToken: 'access.jwt', user: USER });
      expect(body).not.toHaveProperty('refreshToken');
    });
  });

  it('refresh should pass the cookie value to the service', async () => {
    await controller.refresh(REQUEST, RESPONSE);

    expect(cookies.read).toHaveBeenCalledWith(REQUEST);
    expect(authService.refresh).toHaveBeenCalledWith('old.refresh.jwt');
  });

  it('logout should end the session and clear the cookie', async () => {
    await expect(controller.logout(REQUEST, RESPONSE)).resolves.toBeUndefined();

    expect(authService.logout).toHaveBeenCalledWith('old.refresh.jwt');
    expect(cookies.clear).toHaveBeenCalledWith(RESPONSE);
  });

  it('me should load the profile of the authenticated user', async () => {
    await expect(controller.me({ id: USER.id, email: USER.email })).resolves.toEqual(USER);

    expect(authService.getProfile).toHaveBeenCalledWith(USER.id);
  });
});
