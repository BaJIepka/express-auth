import { AppError, ERROR_CODES, HTTP_STATUS } from '@/errors';

describe('AppError', () => {
  it('sets code, message and name', () => {
    const error = new AppError('NOT_FOUND', 'Пользователь не найден');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Пользователь не найден');
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
  });

  it('carries optional validation details', () => {
    const details = [{ field: 'email', message: 'Неверный формат email' }];
    const error = new AppError('VALIDATION_ERROR', 'Ошибка валидации', details);
    expect(error.details).toEqual(details);
  });

  it('leaves details undefined when not provided', () => {
    const error = new AppError('UNAUTHORIZED', 'Токен не предоставлен');
    expect(error.details).toBeUndefined();
  });
});

describe('HTTP_STATUS', () => {
  it.each(Object.values(ERROR_CODES))('maps error code "%s" to a known HTTP status', (code) => {
    expect(HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    expect(HTTP_STATUS[code]).toBeLessThan(600);
  });

  it('maps every AppError code used in HTTP_STATUS to the expected status', () => {
    expect(HTTP_STATUS[ERROR_CODES.VALIDATION_ERROR]).toBe(400);
    expect(HTTP_STATUS[ERROR_CODES.UNAUTHORIZED]).toBe(401);
    expect(HTTP_STATUS[ERROR_CODES.FORBIDDEN]).toBe(403);
    expect(HTTP_STATUS[ERROR_CODES.NOT_FOUND]).toBe(404);
    expect(HTTP_STATUS[ERROR_CODES.CONFLICT]).toBe(409);
    expect(HTTP_STATUS[ERROR_CODES.TOO_MANY_REQUESTS]).toBe(429);
    expect(HTTP_STATUS[ERROR_CODES.INTERNAL]).toBe(500);
  });
});
