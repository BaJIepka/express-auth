import type { NextFunction, Request, Response } from 'express';

import { prisma } from '@/config/database';
import { AppError } from '@/errors';
import { valkeyService } from '@/services/valkeyService';
import { verifyAccessToken } from '@/utils/jwt';
import { toSafeUser } from '@/utils/sanitizeUser';

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Токен не предоставлен');
    }

    const token = authHeader.slice(7);

    const isBlacklisted = await valkeyService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AppError('UNAUTHORIZED', 'Токен недействителен');
    }

    let payload: { userId: number; email: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError('UNAUTHORIZED', 'Недействительный или истёкший токен');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Пользователь не найден');
    }

    req.user = toSafeUser(user);
    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
}
