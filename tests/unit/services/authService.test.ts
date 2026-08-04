jest.mock('@/config/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/services/valkeyService', () => ({
  valkeyService: {
    isLoginBlocked: jest.fn(),
    incrementLoginAttempts: jest.fn(),
    blockLogin: jest.fn(),
    resetLoginAttempts: jest.fn(),
  },
}));
jest.mock('@/services/tokenService', () => ({
  tokenService: {
    generateTokens: jest.fn(),
    refreshTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    blacklistAccessToken: jest.fn(),
  },
}));
jest.mock('@/utils/bcrypt', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from '@/config/database';
import { authService } from '@/services/authService';
import { tokenService } from '@/services/tokenService';
import { valkeyService } from '@/services/valkeyService';
import { comparePassword, hashPassword } from '@/utils/bcrypt';

const findUnique = prisma.user.findUnique as jest.Mock;
const createUser = prisma.user.create as jest.Mock;
const updateUser = prisma.user.update as jest.Mock;

const isLoginBlocked = valkeyService.isLoginBlocked as jest.Mock;
const incrementLoginAttempts = valkeyService.incrementLoginAttempts as jest.Mock;
const blockLogin = valkeyService.blockLogin as jest.Mock;
const resetLoginAttempts = valkeyService.resetLoginAttempts as jest.Mock;

const generateTokens = tokenService.generateTokens as jest.Mock;
const refreshTokens = tokenService.refreshTokens as jest.Mock;
const revokeRefreshToken = tokenService.revokeRefreshToken as jest.Mock;
const revokeAllUserTokens = tokenService.revokeAllUserTokens as jest.Mock;
const blacklistAccessToken = tokenService.blacklistAccessToken as jest.Mock;

const hashPasswordMock = hashPassword as jest.Mock;
const comparePasswordMock = comparePassword as jest.Mock;

const dbUser = {
  id: 1,
  email: 'user@example.com',
  password: 'hashed-password',
  name: 'Иван',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('authService.register', () => {
  it('rejects when the email is already taken', async () => {
    findUnique.mockResolvedValue(dbUser);

    await expect(
      authService.register({ email: 'user@example.com', password: 'Password123', name: 'Иван' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user with a hashed password and issues tokens', async () => {
    findUnique.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue('hashed-password');
    createUser.mockResolvedValue(dbUser);
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await authService.register({
      email: 'user@example.com',
      password: 'Password123',
      name: 'Иван',
    });

    expect(hashPasswordMock).toHaveBeenCalledWith('Password123');
    expect(createUser).toHaveBeenCalledWith({
      data: { email: 'user@example.com', password: 'hashed-password', name: 'Иван' },
    });
    expect(result.user).not.toHaveProperty('password');
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
  });
});

describe('authService.login', () => {
  const credentials = { email: 'user@example.com', password: 'Password123' };

  it('rejects when the account is blocked', async () => {
    isLoginBlocked.mockResolvedValue(true);

    await expect(authService.login(credentials)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown email and records a failed attempt', async () => {
    isLoginBlocked.mockResolvedValue(false);
    findUnique.mockResolvedValue(null);
    incrementLoginAttempts.mockResolvedValue(1);

    await expect(authService.login(credentials)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(incrementLoginAttempts).toHaveBeenCalledWith('user@example.com');
  });

  it('rejects an incorrect password and records a failed attempt', async () => {
    isLoginBlocked.mockResolvedValue(false);
    findUnique.mockResolvedValue(dbUser);
    comparePasswordMock.mockResolvedValue(false);
    incrementLoginAttempts.mockResolvedValue(2);

    await expect(authService.login(credentials)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('blocks the account once the max attempts are reached', async () => {
    isLoginBlocked.mockResolvedValue(false);
    findUnique.mockResolvedValue(dbUser);
    comparePasswordMock.mockResolvedValue(false);
    incrementLoginAttempts.mockResolvedValue(5);

    await expect(authService.login(credentials)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(blockLogin).toHaveBeenCalledWith('user@example.com');
  });

  it('resets attempts and issues tokens on success', async () => {
    isLoginBlocked.mockResolvedValue(false);
    findUnique.mockResolvedValue(dbUser);
    comparePasswordMock.mockResolvedValue(true);
    generateTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await authService.login(credentials);

    expect(resetLoginAttempts).toHaveBeenCalledWith('user@example.com');
    expect(result.accessToken).toBe('at');
    expect(result.user).not.toHaveProperty('password');
  });
});

describe('authService.refresh', () => {
  it('delegates to tokenService.refreshTokens', async () => {
    refreshTokens.mockResolvedValue({ accessToken: 'at2', refreshToken: 'rt2' });
    const result = await authService.refresh('rt-old');
    expect(refreshTokens).toHaveBeenCalledWith('rt-old');
    expect(result).toEqual({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('authService.logout', () => {
  it('revokes the refresh token and skips blacklisting when no access token is given', async () => {
    await authService.logout('rt-abc');
    expect(revokeRefreshToken).toHaveBeenCalledWith('rt-abc');
    expect(blacklistAccessToken).not.toHaveBeenCalled();
  });

  it('revokes the refresh token and blacklists the access token when given', async () => {
    await authService.logout('rt-abc', 'at-abc');
    expect(revokeRefreshToken).toHaveBeenCalledWith('rt-abc');
    expect(blacklistAccessToken).toHaveBeenCalledWith('at-abc');
  });
});

describe('authService.changePassword', () => {
  const input = { oldPassword: 'OldPassword1', newPassword: 'NewPassword2' };

  it('rejects when the user does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(authService.changePassword(1, input, 'at-abc')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects an incorrect old password', async () => {
    findUnique.mockResolvedValue(dbUser);
    comparePasswordMock.mockResolvedValue(false);

    await expect(authService.changePassword(1, input, 'at-abc')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates the password and revokes all existing sessions on success', async () => {
    findUnique.mockResolvedValue(dbUser);
    comparePasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue('new-hashed-password');
    updateUser.mockResolvedValue({ ...dbUser, password: 'new-hashed-password' });

    await authService.changePassword(1, input, 'at-abc');

    expect(hashPasswordMock).toHaveBeenCalledWith('NewPassword2');
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: 'new-hashed-password' },
    });
    expect(revokeAllUserTokens).toHaveBeenCalledWith(1);
    expect(blacklistAccessToken).toHaveBeenCalledWith('at-abc');
  });
});
