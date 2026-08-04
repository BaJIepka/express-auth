import type { NextFunction, Request, Response } from 'express';

import { authService } from '@/services/authService';
import type {
  ChangePasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '@/validators/authValidator';

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.register(req.body as RegisterInput);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body as LoginInput);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  refresh: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body as RefreshInput;
      const result = await authService.refresh(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body as LogoutInput;
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

      await authService.logout(refreshToken, accessToken);
      res.status(200).json({ success: true, data: { message: 'Выход выполнен успешно' } });
    } catch (error) {
      next(error);
    }
  },

  me: (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json({ success: true, data: { user: req.user } });
    } catch (error) {
      next(error);
    }
  },

  changePassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.changePassword(req.user!.id, req.body as ChangePasswordInput, req.token!);
      res.status(200).json({ success: true, data: { message: 'Пароль успешно изменён' } });
    } catch (error) {
      next(error);
    }
  },
};
