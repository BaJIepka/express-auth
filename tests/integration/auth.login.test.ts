import request from 'supertest';

import { app } from '@/app';

import { expectError, expectSuccess } from './apiHelpers';

interface LoginData {
  user: { id: number; email: string };
  accessToken: string;
  refreshToken: string;
}

const credentials = { email: 'login-user@example.com', password: 'Password123' };

async function registerUser() {
  await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, name: 'Логин Тест' });
}

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('logs in with correct credentials and returns tokens', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    const data = expectSuccess<LoginData>(res);
    expect(data.user.email).toBe(credentials.email);
    expect(typeof data.accessToken).toBe('string');
    expect(typeof data.refreshToken).toBe('string');
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(res.status).toBe(401);
    expect(expectError(res).code).toBe('UNAUTHORIZED');
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(expectError(res).code).toBe('UNAUTHORIZED');
  });

  it('rejects a request missing the password field', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: credentials.email });

    expect(res.status).toBe(400);
    expect(expectError(res).code).toBe('VALIDATION_ERROR');
  });

  it('blocks the account after the configured number of failed attempts', async () => {
    const wrongCreds = { ...credentials, password: 'WrongPassword1' };

    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/auth/login').send(wrongCreds);
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(app).post('/api/auth/login').send(wrongCreds);
    expect(blockedRes.status).toBe(429);
    expect(expectError(blockedRes).code).toBe('TOO_MANY_REQUESTS');

    const evenWithCorrectPassword = await request(app).post('/api/auth/login').send(credentials);
    expect(evenWithCorrectPassword.status).toBe(429);
  }, 20000);

  it('resets the failed-attempt counter after a successful login', async () => {
    const wrongCreds = { ...credentials, password: 'WrongPassword1' };

    await request(app).post('/api/auth/login').send(wrongCreds);
    await request(app).post('/api/auth/login').send(wrongCreds);

    const success = await request(app).post('/api/auth/login').send(credentials);
    expect(success.status).toBe(200);

    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/auth/login').send(wrongCreds);
      expect(res.status).toBe(401);
    }
  }, 20000);
});
