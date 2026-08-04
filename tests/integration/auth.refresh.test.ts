import jwt from 'jsonwebtoken';
import request from 'supertest';

import { app } from '@/app';
import { env } from '@/config/env';

import { expectSuccess } from './apiHelpers';

interface RegisterData {
  accessToken: string;
  refreshToken: string;
}

interface RefreshData {
  accessToken: string;
  refreshToken: string;
}

const credentials = { email: 'refresh-user@example.com', password: 'Password123' };

async function registerAndGetTokens() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, name: 'Рефреш Тест' });
  return expectSuccess<RegisterData>(res);
}

describe('POST /api/auth/refresh', () => {
  it('issues a new token pair for a valid refresh token', async () => {
    const { refreshToken } = await registerAndGetTokens();

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    const data = expectSuccess<RefreshData>(res);
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
    expect(data.refreshToken).not.toBe(refreshToken);
  });

  it('rejects reuse of an already-consumed refresh token', async () => {
    const { refreshToken } = await registerAndGetTokens();

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(second.status).toBe(401);
  });

  it('rejects a malformed refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const expiredToken = jwt.sign({ userId: 1, type: 'refresh' }, env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: expiredToken });
    expect(res.status).toBe(401);
  });

  it('rejects an access token presented as a refresh token', async () => {
    const { accessToken } = await registerAndGetTokens();

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken });

    expect(res.status).toBe(401);
  });

  it('rejects a missing refresh token with a validation error', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});
