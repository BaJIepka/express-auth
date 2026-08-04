import request from 'supertest';

import { app } from '@/app';

import { expectError, expectSuccess } from './apiHelpers';

interface RegisterData {
  accessToken: string;
  refreshToken: string;
}

const credentials = { email: 'change-pw-user@example.com', password: 'Password123' };

async function registerAndGetTokens() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, name: 'Смена Пароля' });
  return expectSuccess<RegisterData>(res);
}

describe('POST /api/auth/change-password', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ oldPassword: credentials.password, newPassword: 'NewPassword2' });
    expect(res.status).toBe(401);
  });

  it('rejects an incorrect old password', async () => {
    const { accessToken } = await registerAndGetTokens();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: 'WrongPassword1', newPassword: 'NewPassword2' });

    expect(res.status).toBe(401);
    expect(expectError(res).code).toBe('UNAUTHORIZED');
  });

  it('rejects a weak new password', async () => {
    const { accessToken } = await registerAndGetTokens();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: credentials.password, newPassword: 'weak' });

    expect(res.status).toBe(400);
    expect(expectError(res).code).toBe('VALIDATION_ERROR');
  });

  it('changes the password, revokes sessions, and allows login with the new password', async () => {
    const { accessToken, refreshToken } = await registerAndGetTokens();
    const newPassword = 'NewPassword2';

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ oldPassword: credentials.password, newPassword });
    expect(changeRes.status).toBe(200);

    const oldAccessTokenUse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(oldAccessTokenUse.status).toBe(401);

    const oldRefreshTokenUse = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(oldRefreshTokenUse.status).toBe(401);

    const loginWithOldPassword = await request(app).post('/api/auth/login').send(credentials);
    expect(loginWithOldPassword.status).toBe(401);

    const loginWithNewPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: newPassword });
    expect(loginWithNewPassword.status).toBe(200);
  });
});
