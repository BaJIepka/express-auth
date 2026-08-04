import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '@/errors';
import { validate } from '@/middleware/validation';

describe('validate middleware', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().optional(),
  });

  function buildReq(body: unknown): Request {
    return { body } as Request;
  }

  it('calls next() with no error and assigns the parsed body on success', () => {
    const req = buildReq({ email: 'user@example.com', extra: 'ignored' });
    const next = jest.fn<void, [unknown?]>();

    validate(schema)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'user@example.com' });
  });

  it('calls next() with a VALIDATION_ERROR AppError on failure', () => {
    const req = buildReq({ email: 'not-an-email' });
    const next = jest.fn<void, [unknown?]>();

    validate(schema)(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toHaveLength(1);
    expect(error.details?.[0]?.field).toBe('email');
    expect(typeof error.details?.[0]?.message).toBe('string');
  });

  it('reports one detail entry per failing field', () => {
    const req = buildReq({ email: 'not-an-email', age: 'not-a-number' });
    const next = jest.fn<void, [unknown?]>();

    validate(schema)(req, {} as Response, next);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.details).toHaveLength(2);
  });
});
