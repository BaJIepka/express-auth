import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '@/errors';

export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      next(new AppError('VALIDATION_ERROR', 'Ошибка валидации', details));
      return;
    }

    req.body = result.data;
    next();
  };
}
