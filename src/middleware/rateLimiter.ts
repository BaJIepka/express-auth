import { NextFunction, Request, Response } from 'express';

import { AppError } from '@/errors';
import { valkeyService } from '@/services/valkeyService';

const MAX_REQUESTS = 100;
const WINDOW_SECONDS = 60;

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const { allowed, remaining, resetIn } = await valkeyService.checkRateLimit(
      ip,
      MAX_REQUESTS,
      WINDOW_SECONDS,
    );

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetIn);

    if (!allowed) {
      throw new AppError('TOO_MANY_REQUESTS', 'Слишком много запросов. Попробуйте позже');
    }

    next();
  } catch (error) {
    next(error);
  }
}
