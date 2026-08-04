import '@/docs/zod-extend';

import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.email('Неверный формат email').max(255).openapi({ example: 'user@example.com' }),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[a-zA-Z]/, 'Должна быть хотя бы одна буква')
      .regex(/[0-9]/, 'Должна быть хотя бы одна цифра')
      .openapi({ example: 'Password123' }),
    name: z
      .string()
      .min(2, 'Минимум 2 символа')
      .max(50, 'Максимум 50 символов')
      .regex(/^[a-zA-Zа-яА-ЯёЁ\s]+$/, 'Только буквы и пробелы')
      .openapi({ example: 'Иван Иванов' }),
  })
  .openapi('RegisterRequest');

export const loginSchema = z
  .object({
    email: z.email('Неверный формат email').openapi({ example: 'user@example.com' }),
    password: z.string().min(1, 'Пароль обязателен').openapi({ example: 'Password123' }),
  })
  .openapi('LoginRequest');

export const refreshSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token обязателен')
      .openapi({ example: 'eyJhbGciOi...' }),
  })
  .openapi('RefreshRequest');

export const logoutSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token обязателен')
      .openapi({ example: 'eyJhbGciOi...' }),
  })
  .openapi('LogoutRequest');

export const changePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, 'Старый пароль обязателен')
      .openapi({ example: 'OldPassword123' }),
    newPassword: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[a-zA-Z]/, 'Должна быть хотя бы одна буква')
      .regex(/[0-9]/, 'Должна быть хотя бы одна цифра')
      .openapi({ example: 'NewPassword456' }),
  })
  .openapi('ChangePasswordRequest');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
