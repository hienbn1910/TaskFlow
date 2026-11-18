import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AUTH_ERROR } from '@common/constants/auth.constant';
import type { jwtConfig } from '@config/index';

import { TokenService } from '../token.service';

const USER_ID = '3f8b2c1e-5d4a-4b6c-9e7f-1a2b3c4d5e6f';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const config: ConfigType<typeof jwtConfig> = {
  accessSecret: 'test-access-secret-at-least-32-characters',
  refreshSecret: 'test-refresh-secret-at-least-32-characters',
  accessExpiry: '15m',
  refreshExpiry: '7d',
};

const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('TokenService', () => {
  // Real JwtService: these tests check actual signing/verification, not mocks
  const jwt = new JwtService();
  const service = new TokenService(jwt, config);

  describe('access token', () => {
    it('should round-trip: sign then verify returns the user id', async () => {
      const token = await service.signAccess(USER_ID);

      await expect(service.verifyAccess(token)).resolves.toEqual({ sub: USER_ID });
    });

    it('should expire after the configured duration (15m)', async () => {
      const token = await service.signAccess(USER_ID);
      const decoded = jwt.decode<{ iat: number; exp: number }>(token);

      expect(decoded.exp - decoded.iat).toBe(15 * 60);
    });
  });

  describe('refresh token', () => {
    it('should round-trip with a uuid jti', async () => {
      const payload = await service.verifyRefresh(await service.signRefresh(USER_ID));

      expect(payload.sub).toBe(USER_ID);
      expect(payload.jti).toMatch(UUID_REGEX);
    });

    it('should be unique even for the same user in the same second', async () => {
      const [first, second] = [await service.signRefresh(USER_ID), await service.signRefresh(USER_ID)];

      expect(first).not.toBe(second);
    });
  });

  describe('token type confusion', () => {
    it('should reject an access token used as a refresh token', async () => {
      const accessToken = await service.signAccess(USER_ID);

      await expect(service.verifyRefresh(accessToken)).rejects.toThrow(
        AUTH_ERROR.INVALID_REFRESH_TOKEN,
      );
    });

    it('should reject a refresh token used as an access token', async () => {
      const refreshToken = await service.signRefresh(USER_ID);

      await expect(service.verifyAccess(refreshToken)).rejects.toThrow(AUTH_ERROR.UNAUTHORIZED);
    });
  });

  describe('rejected tokens', () => {
    const nowSeconds = (): number => Math.floor(Date.now() / 1000);

    it('should reject an expired token', async () => {
      const expired = await jwt.signAsync(
        { sub: USER_ID, exp: nowSeconds() - 1 },
        { secret: config.accessSecret },
      );

      await expect(service.verifyAccess(expired)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token with a tampered signature', async () => {
      const token = await service.signAccess(USER_ID);
      const lastChar = token.endsWith('A') ? 'B' : 'A';

      await expect(service.verifyAccess(token.slice(0, -1) + lastChar)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a token with a tampered payload (other user id)', async () => {
      const [header, , signature] = (await service.signAccess(USER_ID)).split('.');
      const forgedPayload = base64url({ sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

      await expect(service.verifyAccess(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an unsigned token (alg: none)', async () => {
      const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: USER_ID })}.`;

      await expect(service.verifyAccess(unsigned)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token signed with another algorithm, even with the right secret', async () => {
      const hs512 = await jwt.signAsync(
        { sub: USER_ID },
        { secret: config.accessSecret, algorithm: 'HS512' },
      );

      await expect(service.verifyAccess(hs512)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a validly signed token with the wrong payload shape', async () => {
      const badShape = await jwt.signAsync({ sub: 'not-a-uuid' }, { secret: config.accessSecret });

      await expect(service.verifyAccess(badShape)).rejects.toThrow(UnauthorizedException);
    });

    it.each(['', 'garbage', 'a.b.c'])('should reject malformed input "%s"', async (input) => {
      await expect(service.verifyAccess(input)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh expiry helpers', () => {
    it('should return expiresAt 7 days from now', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const before = Date.now();

      const expiresAt = service.refreshExpiresAt().getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + sevenDaysMs);
    });

    it('should return the cookie max age in ms', () => {
      expect(service.refreshMaxAgeMs()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
