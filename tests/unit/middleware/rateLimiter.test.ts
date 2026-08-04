import type { Request, Response } from 'express';

jest.mock('@/services/valkeyService', () => ({
  valkeyService: { checkRateLimit: jest.fn() },
}));

import { AppError } from '@/errors';
import { rateLimiter } from '@/middleware/rateLimiter';
import { valkeyService } from '@/services/valkeyService';

const checkRateLimit = valkeyService.checkRateLimit as jest.Mock;

function buildRes(): Response {
  const res = {} as Response;
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

describe('rateLimiter middleware', () => {
  it('sets rate-limit headers and calls next() when within the limit', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 42, resetIn: 30 });
    const req = { ip: '203.0.113.5', socket: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn<void, [unknown?]>();

    await rateLimiter(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('203.0.113.5', 100, 60);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 42);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 30);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() with a TOO_MANY_REQUESTS AppError when the limit is exceeded', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 10 });
    const req = { ip: '203.0.113.5', socket: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn<void, [unknown?]>();

    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('falls back to the socket remote address when req.ip is missing', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetIn: 60 });
    const req = { ip: undefined, socket: { remoteAddress: '198.51.100.1' } } as unknown as Request;
    const res = buildRes();
    const next = jest.fn<void, [unknown?]>();

    await rateLimiter(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('198.51.100.1', 100, 60);
  });

  it('falls back to "unknown" when neither req.ip nor the socket address is available', async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetIn: 60 });
    const req = { ip: undefined, socket: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn<void, [unknown?]>();

    await rateLimiter(req, res, next);

    expect(checkRateLimit).toHaveBeenCalledWith('unknown', 100, 60);
  });

  it('forwards errors from valkeyService to next()', async () => {
    const failure = new Error('valkey unavailable');
    checkRateLimit.mockRejectedValue(failure);
    const req = { ip: '203.0.113.5', socket: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn<void, [unknown?]>();

    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
