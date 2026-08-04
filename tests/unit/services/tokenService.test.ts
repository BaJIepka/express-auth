jest.mock('@/config/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@/services/valkeyService', () => ({
  valkeyService: {
    storeRefreshToken: jest.fn(),
    consumeRefreshToken: jest.fn(),
    deleteRefreshToken: jest.fn(),
    blacklistToken: jest.fn(),
  },
}));
jest.mock('@/utils/jwt', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  getTokenRemainingSeconds: jest.fn(),
}));

import { prisma } from '@/config/database';
import { tokenService } from '@/services/tokenService';
import { valkeyService } from '@/services/valkeyService';
import {
  getTokenRemainingSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/utils/jwt';

const findUnique = prisma.user.findUnique as jest.Mock;
const createRefreshToken = prisma.refreshToken.create as jest.Mock<
  unknown,
  [{ data: { token: string; userId: number; expiresAt: Date } }]
>;
const deleteRefreshToken = prisma.refreshToken.delete as jest.Mock;
const deleteManyRefreshTokens = prisma.refreshToken.deleteMany as jest.Mock;
const findManyRefreshTokens = prisma.refreshToken.findMany as jest.Mock;

const storeRefreshToken = valkeyService.storeRefreshToken as jest.Mock;
const consumeRefreshToken = valkeyService.consumeRefreshToken as jest.Mock;
const deleteValkeyRefreshToken = valkeyService.deleteRefreshToken as jest.Mock;
const blacklistToken = valkeyService.blacklistToken as jest.Mock;

const signAccessTokenMock = signAccessToken as jest.Mock;
const signRefreshTokenMock = signRefreshToken as jest.Mock;
const verifyRefreshTokenMock = verifyRefreshToken as jest.Mock;
const getTokenRemainingSecondsMock = getTokenRemainingSeconds as jest.Mock;

describe('tokenService', () => {
  describe('generateTokens', () => {
    it('signs both tokens, persists the refresh token in the DB and Valkey', async () => {
      signAccessTokenMock.mockReturnValue('access-token');
      signRefreshTokenMock.mockReturnValue('refresh-token');
      createRefreshToken.mockResolvedValue({});
      storeRefreshToken.mockResolvedValue(undefined);

      const result = await tokenService.generateTokens(1, 'user@example.com');

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(signAccessTokenMock).toHaveBeenCalledWith({ userId: 1, email: 'user@example.com' });
      expect(signRefreshTokenMock).toHaveBeenCalledWith({ userId: 1 });
      expect(createRefreshToken).toHaveBeenCalledTimes(1);
      const createArgs = createRefreshToken.mock.calls[0]?.[0] as {
        data: { token: string; userId: number; expiresAt: Date };
      };
      expect(createArgs.data.token).toBe('refresh-token');
      expect(createArgs.data.userId).toBe(1);
      expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
      expect(storeRefreshToken).toHaveBeenCalledWith('refresh-token', 1);
    });
  });

  describe('refreshTokens', () => {
    it('rejects a token that fails verification', async () => {
      verifyRefreshTokenMock.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(tokenService.refreshTokens('bad-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('issues new tokens when the refresh token is found in Valkey', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(1);
      deleteManyRefreshTokens.mockResolvedValue({ count: 1 });
      findUnique.mockResolvedValue({ id: 1, email: 'user@example.com' });
      signAccessTokenMock.mockReturnValue('new-access');
      signRefreshTokenMock.mockReturnValue('new-refresh');
      createRefreshToken.mockResolvedValue({});
      storeRefreshToken.mockResolvedValue(undefined);

      const result = await tokenService.refreshTokens('old-refresh');

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      expect(deleteManyRefreshTokens).toHaveBeenCalledWith({ where: { token: 'old-refresh' } });
    });

    it('falls back to an atomic DB delete when Valkey does not have the token', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(null);
      deleteRefreshToken.mockResolvedValue({
        token: 'old-refresh',
        userId: 1,
        expiresAt: new Date(Date.now() + 60_000),
      });
      findUnique.mockResolvedValue({ id: 1, email: 'user@example.com' });
      signAccessTokenMock.mockReturnValue('new-access');
      signRefreshTokenMock.mockReturnValue('new-refresh');
      createRefreshToken.mockResolvedValue({});
      storeRefreshToken.mockResolvedValue(undefined);

      const result = await tokenService.refreshTokens('old-refresh');

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      expect(deleteRefreshToken).toHaveBeenCalledWith({ where: { token: 'old-refresh' } });
    });

    it('rejects when the DB delete fails because the token is unknown', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(null);
      deleteRefreshToken.mockRejectedValue(new Error('Record not found'));

      await expect(tokenService.refreshTokens('old-refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('rejects an expired token found via the DB fallback', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(null);
      deleteRefreshToken.mockResolvedValue({
        token: 'old-refresh',
        userId: 1,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(tokenService.refreshTokens('old-refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('rejects when the DB row belongs to a different user than the JWT claims', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(null);
      deleteRefreshToken.mockResolvedValue({
        token: 'old-refresh',
        userId: 2,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(tokenService.refreshTokens('old-refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('rejects when the user no longer exists', async () => {
      verifyRefreshTokenMock.mockReturnValue({ userId: 1 });
      consumeRefreshToken.mockResolvedValue(1);
      deleteManyRefreshTokens.mockResolvedValue({ count: 1 });
      findUnique.mockResolvedValue(null);

      await expect(tokenService.refreshTokens('old-refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('deletes the token from Valkey and the database', async () => {
      await tokenService.revokeRefreshToken('rt-abc');
      expect(deleteValkeyRefreshToken).toHaveBeenCalledWith('rt-abc');
      expect(deleteManyRefreshTokens).toHaveBeenCalledWith({ where: { token: 'rt-abc' } });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('deletes all of the user tokens from the database and Valkey', async () => {
      findManyRefreshTokens.mockResolvedValue([{ token: 'rt-1' }, { token: 'rt-2' }]);
      deleteManyRefreshTokens.mockResolvedValue({ count: 2 });

      await tokenService.revokeAllUserTokens(1);

      expect(deleteManyRefreshTokens).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(deleteValkeyRefreshToken).toHaveBeenCalledWith('rt-1');
      expect(deleteValkeyRefreshToken).toHaveBeenCalledWith('rt-2');
    });
  });

  describe('blacklistAccessToken', () => {
    it('blacklists the token for its remaining lifetime', async () => {
      getTokenRemainingSecondsMock.mockReturnValue(120);
      await tokenService.blacklistAccessToken('at-abc');
      expect(blacklistToken).toHaveBeenCalledWith('at-abc', 120);
    });
  });
});
