import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';

import { RefreshCookieService } from '@common/cookies/refresh-cookie.service';
import { USER_ERROR } from '@common/constants/user.constant';

import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

const AUTH_USER = { id: '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f', email: 'hien@example.com' };

const PUBLIC_USER = {
  id: AUTH_USER.id,
  email: AUTH_USER.email,
  fullName: 'New Name',
  avatarUrl: null,
  createdAt: '2026-11-18T08:00:00.000Z',
};

const CHANGE = { currentPassword: 'OldSecret1', newPassword: 'NewSecret2' };

// Opaque placeholder: the controller only forwards it to the mocked RefreshCookieService
const RESPONSE = {} as Response;

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Pick<UsersService, 'updateProfile' | 'changePassword'>>;
  let cookies: jest.Mocked<Pick<RefreshCookieService, 'clear'>>;

  beforeEach(async () => {
    usersService = {
      updateProfile: jest.fn().mockResolvedValue(PUBLIC_USER),
      changePassword: jest.fn(),
    };
    cookies = { clear: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: RefreshCookieService, useValue: cookies },
      ],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  describe('updateProfile', () => {
    it('should update the authenticated user and return the public user', async () => {
      const dto = { fullName: 'New Name' };

      await expect(controller.updateProfile(AUTH_USER, dto)).resolves.toEqual(PUBLIC_USER);

      expect(usersService.updateProfile).toHaveBeenCalledWith(AUTH_USER.id, dto);
    });
  });

  describe('changePassword', () => {
    it('should change the password of the authenticated user and return nothing', async () => {
      await expect(controller.changePassword(AUTH_USER, CHANGE, RESPONSE)).resolves.toBeUndefined();

      expect(usersService.changePassword).toHaveBeenCalledWith(AUTH_USER.id, CHANGE);
    });

    it('should clear the refresh cookie AFTER the password was changed', async () => {
      await controller.changePassword(AUTH_USER, CHANGE, RESPONSE);

      expect(cookies.clear).toHaveBeenCalledWith(RESPONSE);
      expect(usersService.changePassword.mock.invocationCallOrder[0]).toBeLessThan(
        cookies.clear.mock.invocationCallOrder[0],
      );
    });

    it('should keep the cookie when the change fails', async () => {
      const error = new BadRequestException(USER_ERROR.CURRENT_PASSWORD_INCORRECT);
      usersService.changePassword.mockRejectedValue(error);

      await expect(controller.changePassword(AUTH_USER, CHANGE, RESPONSE)).rejects.toBe(error);

      expect(cookies.clear).not.toHaveBeenCalled();
    });
  });
});
