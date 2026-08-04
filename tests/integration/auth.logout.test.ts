import request from 'supertest';

import { app } from '@/app';

import { expectSuccess } from './apiHelpers';

interface RegisterData {
  accessToken: string;
  refreshToken: string;
}

const credentials = { email: 'logout-user@example.com', password: 'Password123' };

async function registerAndGetTokens() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, name: 'Логаут Тест' });
  return expectSuccess<RegisterData>(res);
}

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and blacklists the access token', async () => {
    const { accessToken, refreshToken } = await registerAndGetTokens();

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);

    const meAfterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfterLogout.status).toBe(401);
  });

  it('still revokes the refresh token when no Authorization header is provided', async () => {
    const { refreshToken } = await registerAndGetTokens();

    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('rejects a request missing the refresh token', async () => {
    const { accessToken } = await registerAndGetTokens();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
