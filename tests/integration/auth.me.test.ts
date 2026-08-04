import request from 'supertest';

import { app } from '@/app';
import { prisma } from '@/config/database';

import { expectSuccess } from './apiHelpers';

interface RegisterData {
  accessToken: string;
  refreshToken: string;
  user: { id: number };
}

interface MeData {
  user: { id: number; email: string; name: string };
}

const credentials = { email: 'me-user@example.com', password: 'Password123' };

async function registerAndGetTokens() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, name: 'Профиль Тест' });
  return expectSuccess<RegisterData>(res);
}

describe('GET /api/auth/me', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'sometoken');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid access token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user without the password field', async () => {
    const { accessToken } = await registerAndGetTokens();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const data = expectSuccess<MeData>(res);
    expect(data.user).toMatchObject({ email: credentials.email, name: 'Профиль Тест' });
    expect(data.user).not.toHaveProperty('password');
  });

  it('rejects a token belonging to a user that has since been deleted', async () => {
    const { accessToken, user } = await registerAndGetTokens();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});
