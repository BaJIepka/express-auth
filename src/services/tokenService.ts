import { prisma } from '@/config/database';
import { REFRESH_TOKEN_TTL_SECONDS } from '@/config/env';
import { AppError } from '@/errors';
import {
  getTokenRemainingSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/utils/jwt';

import { valkeyService } from './valkeyService';

export const tokenService = {
  async generateTokens(
    userId: number,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = signAccessToken({ userId, email });
    const refreshToken = signRefreshToken({ userId });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    await valkeyService.storeRefreshToken(refreshToken, userId);

    return { accessToken, refreshToken };
  },

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let userId: number;

    try {
      const payload = verifyRefreshToken(refreshToken);
      userId = payload.userId;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Недействительный refresh token');
    }

    // Atomically consume the token so a duplicate concurrent request can't reuse it.
    const valkeyUserId = await valkeyService.consumeRefreshToken(refreshToken);

    if (valkeyUserId === null) {
      // Not in Valkey (evicted or already consumed there) — fall back to an atomic
      // delete in the DB: only the first caller to delete the row gets its data,
      // a second concurrent caller gets a "not found" error and correctly fails.
      let dbToken;
      try {
        dbToken = await prisma.refreshToken.delete({ where: { token: refreshToken } });
      } catch {
        throw new AppError('UNAUTHORIZED', 'Refresh token не найден или истёк');
      }
      if (dbToken.expiresAt < new Date() || dbToken.userId !== userId) {
        throw new AppError('UNAUTHORIZED', 'Refresh token не найден или истёк');
      }
    } else {
      // Valkey copy consumed above; drop the DB row too (not the atomicity gate here).
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Пользователь не найден');
    }

    return this.generateTokens(user.id, user.email);
  },

  async revokeRefreshToken(token: string): Promise<void> {
    await valkeyService.deleteRefreshToken(token);
    await prisma.refreshToken.deleteMany({ where: { token } });
  },

  async revokeAllUserTokens(userId: number): Promise<void> {
    const tokens = await prisma.refreshToken.findMany({
      where: { userId },
      select: { token: true },
    });

    await prisma.refreshToken.deleteMany({ where: { userId } });

    for (const { token } of tokens) {
      await valkeyService.deleteRefreshToken(token);
    }
  },

  async blacklistAccessToken(token: string): Promise<void> {
    const ttl = getTokenRemainingSeconds(token);
    await valkeyService.blacklistToken(token, ttl);
  },
};
