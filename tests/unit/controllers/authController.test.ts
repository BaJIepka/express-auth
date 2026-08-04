import type { Request, Response } from 'express';

jest.mock('@/services/authService', () => ({
  authService: {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
  },
}));

import { authController } from '@/controllers/authController';
import { authService } from '@/services/authService';

const register = authService.register as jest.Mock;
const login = authService.login as jest.Mock;
const refresh = authService.refresh as jest.Mock;
const logout = authService.logout as jest.Mock;
const changePassword = authService.changePassword as jest.Mock;

function buildRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController.register', () => {
  it('responds with 201 and the service result on success', async () => {
    const payload = { user: { id: 1 }, accessToken: 'at', refreshToken: 'rt' };
    register.mockResolvedValue(payload);
    const req = { body: { email: 'a@b.com', password: 'Password123', name: 'A' } } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: payload });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next()', async () => {
    const failure = new Error('boom');
    register.mockRejectedValue(failure);
    const req = { body: {} } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('authController.login', () => {
  it('responds with 200 and the service result on success', async () => {
    const payload = { user: { id: 1 }, accessToken: 'at', refreshToken: 'rt' };
    login.mockResolvedValue(payload);
    const req = { body: { email: 'a@b.com', password: 'Password123' } } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: payload });
  });

  it('forwards errors to next()', async () => {
    const failure = new Error('boom');
    login.mockRejectedValue(failure);
    const req = { body: {} } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('authController.refresh', () => {
  it('passes the refresh token through and responds with new tokens', async () => {
    const payload = { accessToken: 'at2', refreshToken: 'rt2' };
    refresh.mockResolvedValue(payload);
    const req = { body: { refreshToken: 'rt-old' } } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.refresh(req, res, next);

    expect(refresh).toHaveBeenCalledWith('rt-old');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: payload });
  });

  it('forwards errors to next()', async () => {
    const failure = new Error('boom');
    refresh.mockRejectedValue(failure);
    const req = { body: { refreshToken: 'rt-old' } } as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.refresh(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('authController.logout', () => {
  it('extracts the bearer token from the Authorization header', async () => {
    logout.mockResolvedValue(undefined);
    const req = {
      body: { refreshToken: 'rt-abc' },
      headers: { authorization: 'Bearer at-abc' },
    } as unknown as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.logout(req, res, next);

    expect(logout).toHaveBeenCalledWith('rt-abc', 'at-abc');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Выход выполнен успешно' },
    });
  });

  it('passes undefined as the access token when no Authorization header is present', async () => {
    logout.mockResolvedValue(undefined);
    const req = { body: { refreshToken: 'rt-abc' }, headers: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.logout(req, res, next);

    expect(logout).toHaveBeenCalledWith('rt-abc', undefined);
  });

  it('forwards errors to next()', async () => {
    const failure = new Error('boom');
    logout.mockRejectedValue(failure);
    const req = { body: { refreshToken: 'rt-abc' }, headers: {} } as unknown as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.logout(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('authController.me', () => {
  it('responds with the authenticated user from the request', () => {
    const user = { id: 1, email: 'a@b.com', name: 'A', createdAt: new Date() };
    const req = { user } as Request;
    const res = buildRes();
    const next = jest.fn();

    authController.me(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { user } });
  });
});

describe('authController.changePassword', () => {
  it('calls the service with the authenticated user id and token', async () => {
    changePassword.mockResolvedValue(undefined);
    const req = {
      user: { id: 1, email: 'a@b.com', name: 'A', createdAt: new Date() },
      token: 'at-abc',
      body: { oldPassword: 'Old1', newPassword: 'New12345' },
    } as unknown as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.changePassword(req, res, next);

    expect(changePassword).toHaveBeenCalledWith(1, req.body, 'at-abc');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Пароль успешно изменён' },
    });
  });

  it('forwards errors to next()', async () => {
    const failure = new Error('boom');
    changePassword.mockRejectedValue(failure);
    const req = {
      user: { id: 1, email: 'a@b.com', name: 'A', createdAt: new Date() },
      token: 'at-abc',
      body: {},
    } as unknown as Request;
    const res = buildRes();
    const next = jest.fn();

    await authController.changePassword(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
