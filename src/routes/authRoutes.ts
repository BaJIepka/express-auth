import { Router } from 'express';

import { authController } from '@/controllers/authController';
import { authMiddleware } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '@/validators/authValidator';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);
router.get('/me', authMiddleware, authController.me);
router.post(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
