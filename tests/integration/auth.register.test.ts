import request from 'supertest';

import { app } from '@/app';
import { prisma } from '@/config/database';

import { expectError, expectSuccess } from './apiHelpers';

interface RegisterData {
  user: { id: number; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}

describe('POST /api/auth/register', () => {
  const validPayload = {
    email: 'newuser@example.com',
    password: 'Password123',
    name: 'Иван Иванов',
  };

  it('creates a user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send(validPayload);

    expect(res.status).toBe(201);
    const data = expectSuccess<RegisterData>(res);
    expect(data.user).toMatchObject({ email: validPayload.email, name: validPayload.name });
    expect(data.user).not.toHaveProperty('password');
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
  });

  it('persists the user with a bcrypt-hashed password', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const user = await prisma.user.findUnique({ where: { email: validPayload.email } });
    expect(user).not.toBeNull();
    expect(user?.password).not.toBe(validPayload.password);
    expect(user?.password).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(validPayload);
    const res = await request(app).post('/api/auth/register').send(validPayload);

    expect(res.status).toBe(409);
    expect(expectError(res).code).toBe('CONFLICT');
  });

  it('rejects an invalid email with a validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });

    expect(res.status).toBe(400);
    const error = expectError(res);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('rejects a weak password with a validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, password: 'short' });

    expect(res.status).toBe(400);
    expect(expectError(res).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a name containing digits', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, name: 'Ivan123' });

    expect(res.status).toBe(400);
    expect(expectError(res).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a request missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: validPayload.email });

    expect(res.status).toBe(400);
    expect(expectError(res).code).toBe('VALIDATION_ERROR');
  });
});
