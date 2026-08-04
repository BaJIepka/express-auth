import request from 'supertest';

import { app } from '@/app';

import { expectError } from './apiHelpers';

describe('app-level behavior', () => {
  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty('paths');
  });

  it('serves the Swagger UI page', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
  });

  it('returns a VALIDATION_ERROR for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com", "password":');

    expect(res.status).toBe(400);
    const error = expectError(res);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Некорректный запрос');
  });

  it('sends helmet security headers on API responses', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sends rate-limit headers on API responses', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    expect(res.headers).toHaveProperty('x-ratelimit-reset');
  });
});

describe('rate limiting', () => {
  it('blocks requests once the per-IP limit is exceeded within the window', async () => {
    let lastRes;
    for (let i = 0; i < 100; i++) {
      lastRes = await request(app).get('/api/auth/me');
    }
    expect(lastRes?.status).toBe(401);

    const blockedRes = await request(app).get('/api/auth/me');
    expect(blockedRes.status).toBe(429);
    expect(expectError(blockedRes).code).toBe('TOO_MANY_REQUESTS');
  }, 30000);
});
