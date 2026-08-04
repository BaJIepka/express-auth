import type { Request, Response } from 'express';

import { AppError } from '@/errors';

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { errorHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

function buildRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  it('maps an AppError to its configured HTTP status and body', () => {
    const res = buildRes();
    const error = new AppError('NOT_FOUND', 'Пользователь не найден');

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Пользователь не найден' },
    });
  });

  it('includes details when present on the AppError', () => {
    const res = buildRes();
    const details = [{ field: 'email', message: 'Неверный формат email' }];
    const error = new AppError('VALIDATION_ERROR', 'Ошибка валидации', details);

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ошибка валидации', details },
    });
  });

  it('maps a body-parser style client error (status 400) to a VALIDATION_ERROR response', () => {
    const res = buildRes();
    const error = Object.assign(new Error('Unexpected token in JSON'), { status: 400 });

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Некорректный запрос' },
    });
  });

  it('honors statusCode as an alternative to status for client errors', () => {
    const res = buildRes();
    const error = Object.assign(new Error('Payload too large'), { statusCode: 413 });

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(413);
  });

  it('falls back to 500 and logs unhandled errors', () => {
    const res = buildRes();
    const error = new Error('boom');

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' },
    });
    expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Unhandled error');
  });

  it('does not treat a 500-range status as a client error', () => {
    const res = buildRes();
    const error = Object.assign(new Error('upstream failure'), { status: 502 });

    errorHandler(error, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
