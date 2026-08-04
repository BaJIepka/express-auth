import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { AppError } from '@/errors';
import { comparePassword, hashPassword } from '@/utils/bcrypt';
import { logger } from '@/utils/logger';
import { type SafeUser, toSafeUser } from '@/utils/sanitizeUser';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@/validators/authValidator';

import { tokenService } from './tokenService';
import { valkeyService } from './valkeyService';

export const authService = {
  async register(
    data: RegisterInput,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('CONFLICT', 'Email уже занят');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: { email: data.email, password: hashedPassword, name: data.name },
    });

    const { accessToken, refreshToken } = await tokenService.generateTokens(user.id, user.email);

    logger.info({ userId: user.id }, 'User registered');

    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async login(
    data: LoginInput,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const isBlocked = await valkeyService.isLoginBlocked(data.email);
    if (isBlocked) {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        `Аккаунт заблокирован. Попробуйте через ${env.LOGIN_BLOCK_DURATION} минут`,
      );
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await comparePassword(data.password, user.password))) {
      const attempts = await valkeyService.incrementLoginAttempts(data.email);

      if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
        await valkeyService.blockLogin(data.email);
        throw new AppError(
          'TOO_MANY_REQUESTS',
          `Превышено количество попыток. Аккаунт заблокирован на ${env.LOGIN_BLOCK_DURATION} минут`,
        );
      }

      throw new AppError('UNAUTHORIZED', 'Неверный email или пароль');
    }

    await valkeyService.resetLoginAttempts(data.email);

    const { accessToken, refreshToken } = await tokenService.generateTokens(user.id, user.email);

    logger.info({ userId: user.id }, 'User logged in');

    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return tokenService.refreshTokens(refreshToken);
  },

  async logout(refreshToken: string, accessToken?: string): Promise<void> {
    await tokenService.revokeRefreshToken(refreshToken);

    if (accessToken) {
      await tokenService.blacklistAccessToken(accessToken);
    }

    logger.info('User logged out');
  },

  async changePassword(
    userId: number,
    data: ChangePasswordInput,
    accessToken: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('NOT_FOUND', 'Пользователь не найден');
    }

    const isValid = await comparePassword(data.oldPassword, user.password);
    if (!isValid) {
      throw new AppError('UNAUTHORIZED', 'Неверный старый пароль');
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await tokenService.revokeAllUserTokens(userId);
    await tokenService.blacklistAccessToken(accessToken);

    logger.info({ userId }, 'Password changed');
  },
};
