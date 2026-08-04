import type { Request, Response } from 'express';

jest.mock('@/config/database', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/services/valkeyService', () => ({
  valkeyService: { isTokenBlacklisted: jest.fn() },
}));
jest.mock('@/utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

import { prisma } from '@/config/database';
import { AppError } from '@/errors';
import { authMiddleware } from '@/middleware/auth';
import { valkeyService } from '@/services/valkeyService';
import { verifyAccessToken } from '@/utils/jwt';

const findUnique = prisma.user.findUnique as jest.Mock;
const isTokenBlacklisted = valkeyService.isTokenBlacklisted as jest.Mock;
const verifyAccessTokenMock = verifyAccessToken as jest.Mock;

function buildReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

async function run(req: Request) {
  const next = jest.fn<void, [unknown?]>();
  await authMiddleware(req, {} as Response, next);
  return next;
}

describe('authMiddleware', () => {
  it('rejects a missing Authorization header', async () => {
    const next = await run(buildReq());
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toMatch(/не предоставлен/);
  });

  it('rejects a header that does not start with "Bearer "', async () => {
    const next = await run(buildReq({ authorization: 'Token abc' }));
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a blacklisted token', async () => {
    isTokenBlacklisted.mockResolvedValue(true);
    const next = await run(buildReq({ authorization: 'Bearer sometoken' }));
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toMatch(/недействителен/);
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
  });

  it('rejects a token that fails verification', async () => {
    isTokenBlacklisted.mockResolvedValue(false);
    verifyAccessTokenMock.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const next = await run(buildReq({ authorization: 'Bearer sometoken' }));
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toMatch(/истёкший токен/);
  });

  it('rejects a valid token for a user that no longer exists', async () => {
    isTokenBlacklisted.mockResolvedValue(false);
    verifyAccessTokenMock.mockReturnValue({ userId: 1, email: 'user@example.com' });
    findUnique.mockResolvedValue(null);

    const next = await run(buildReq({ authorization: 'Bearer sometoken' }));
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toMatch(/не найден/);
  });

  it('attaches the safe user and token to the request on success', async () => {
    isTokenBlacklisted.mockResolvedValue(false);
    verifyAccessTokenMock.mockReturnValue({ userId: 1, email: 'user@example.com' });
    const createdAt = new Date();
    findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      password: 'hashed',
      name: 'Иван',
      createdAt,
      updatedAt: createdAt,
    });

    const req = buildReq({ authorization: 'Bearer sometoken' });
    const next = await run(req);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 1, email: 'user@example.com', name: 'Иван', createdAt });
    expect(req.user).not.toHaveProperty('password');
    expect(req.token).toBe('sometoken');
  });
});
