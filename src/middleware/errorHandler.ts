import type { NextFunction, Request, Response } from 'express';

import { AppError, ERROR_CODES, HTTP_STATUS } from '@/errors';
import { logger } from '@/utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const status = HTTP_STATUS[err.code] ?? 500;
    res.status(status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // express.json()/express.urlencoded() report malformed request bodies (e.g. invalid
  // JSON) as plain errors with an http-errors-style status — surface those as the
  // client error they are instead of masking them as a 500.
  const clientStatus =
    (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode;
  if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
    res.status(clientStatus).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Некорректный запрос',
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL,
      message: 'Внутренняя ошибка сервера',
    },
  });
}
