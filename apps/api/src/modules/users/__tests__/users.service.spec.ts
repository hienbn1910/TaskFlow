import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import { USER_ERROR } from '@common/constants/user.constant';
import { hashPassword, verifyPassword } from '@common/utils/password.util';

import type { UserCredentials, UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../users.repository';
import { UsersService } from '../users.service';

// bcrypt is mocked: tests stay fast and can check exactly what was hashed and compared
jest.mock('@common/utils/password.util');
const mockedHashPassword = jest.mocked(hashPassword);
const mockedVerifyPassword = jest.mocked(verifyPassword);

type UsersMock = jest.Mocked<
  Pick<UsersRepository, 'updateProfile' | 'findCredentialsById' | 'updatePasswordAndRevokeSessions'>
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

const USER_ID = '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f';

const USER: UserEntity = {
  id: USER_ID,
  email: 'hien@example.com',
  fullName: 'Hien Nguyen',
  avatarUrl: null,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-11-18T08:00:00.000Z'),
};

const CREDENTIALS: UserCredentials = { ...USER, password: '$2b$10$storedhash' };

const CHANGE = { currentPassword: 'OldSecret1', newPassword: 'NewSecret2' };

describe('UsersService', () => {
  let service: UsersService;
  let users: UsersMock;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    users = {
      updateProfile: jest.fn(),
      findCredentialsById: jest.fn(),
      updatePasswordAndRevokeSessions: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: users }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateProfile', () => {
    it('should update the given user and return the public user', async () => {
      users.updateProfile.mockResolvedValue({ ...USER, fullName: 'New Name' });

      const result = await service.updateProfile(USER_ID, { fullName: 'New Name' });

      expect(users.updateProfile).toHaveBeenCalledWith(USER_ID, { fullName: 'New Name' });
      expect(result).toEqual({
        id: USER_ID,
        email: 'hien@example.com',
        fullName: 'New Name',
        avatarUrl: null,
        createdAt: '2026-11-18T08:00:00.000Z',
      });
    });

    it('should never return isActive or deletedAt', async () => {
      users.updateProfile.mockResolvedValue(USER);

      const result = await service.updateProfile(USER_ID, { fullName: 'Hien' });

      expect(result).not.toHaveProperty('isActive');
      expect(result).not.toHaveProperty('deletedAt');
    });
  });

  describe('changePassword', () => {
    it('should store the hash of the NEW password and revoke sessions in the same call', async () => {
      users.findCredentialsById.mockResolvedValue(CREDENTIALS);
      mockedVerifyPassword.mockResolvedValue(true);
      mockedHashPassword.mockResolvedValue('$2b$10$newhash');

      await service.changePassword(USER_ID, CHANGE);

      expect(mockedVerifyPassword).toHaveBeenCalledWith('OldSecret1', '$2b$10$storedhash');
      expect(mockedHashPassword).toHaveBeenCalledWith('NewSecret2');
      expect(users.updatePasswordAndRevokeSessions).toHaveBeenCalledTimes(1);
      expect(users.updatePasswordAndRevokeSessions).toHaveBeenCalledWith(USER_ID, '$2b$10$newhash');
    });

    it('should never pass a plain password to the repository', async () => {
      users.findCredentialsById.mockResolvedValue(CREDENTIALS);
      mockedVerifyPassword.mockResolvedValue(true);
      mockedHashPassword.mockResolvedValue('$2b$10$newhash');

      await service.changePassword(USER_ID, CHANGE);

      const args: unknown[] = users.updatePasswordAndRevokeSessions.mock.calls.flat();
      expect(args).not.toContain('NewSecret2');
      expect(args).not.toContain('OldSecret1');
    });

    it('should reject a wrong current password with 400 and write nothing', async () => {
      users.findCredentialsById.mockResolvedValue(CREDENTIALS);
      mockedVerifyPassword.mockResolvedValue(false);

      const error = await captureError(async () => service.changePassword(USER_ID, CHANGE));

      expect(error).toEqual(new BadRequestException(USER_ERROR.CURRENT_PASSWORD_INCORRECT));
      expect(mockedHashPassword).not.toHaveBeenCalled();
      expect(users.updatePasswordAndRevokeSessions).not.toHaveBeenCalled();
    });

    it.each([
      ['missing (or soft-deleted)', null],
      ['inactive', { ...CREDENTIALS, isActive: false }],
    ])('should reject a %s user with 401 and write nothing', async (_case, found) => {
      users.findCredentialsById.mockResolvedValue(found);

      const error = await captureError(async () => service.changePassword(USER_ID, CHANGE));

      expect(error).toEqual(new UnauthorizedException(AUTH_ERROR.UNAUTHORIZED));
      expect(mockedVerifyPassword).not.toHaveBeenCalled();
      expect(users.updatePasswordAndRevokeSessions).not.toHaveBeenCalled();
    });

    it('should load the user from the given id only', async () => {
      users.findCredentialsById.mockResolvedValue(CREDENTIALS);
      mockedVerifyPassword.mockResolvedValue(true);
      mockedHashPassword.mockResolvedValue('$2b$10$newhash');

      await service.changePassword(USER_ID, CHANGE);

      expect(users.findCredentialsById).toHaveBeenCalledWith(USER_ID);
    });
  });
});
