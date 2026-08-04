import '@/docs/zod-extend';

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '@/validators/authValidator';

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const SafeUserSchema = registry.register(
  'SafeUser',
  z.object({
    id: z.number().int().openapi({ example: 1 }),
    email: z.email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'Иван Иванов' }),
    createdAt: z.string().openapi({
      description: 'ISO 8601 date-time',
      example: '2026-08-05T12:00:00.000Z',
    }),
  }),
);

const TokensSchema = z.object({
  accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
  refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
});

const AuthDataSchema = registry.register('AuthData', TokensSchema.extend({ user: SafeUserSchema }));

const MessageSchema = z.object({
  message: z.string().openapi({ example: 'Операция выполнена успешно' }),
});

function successResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'Ошибка валидации' }),
      details: z
        .array(
          z.object({
            field: z.string().openapi({ example: 'email' }),
            message: z.string().openapi({ example: 'Неверный формат email' }),
          }),
        )
        .optional(),
    }),
  }),
);

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const errorResponse = (description: string) => ({
  description,
  ...jsonContent(ErrorResponseSchema),
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Регистрация нового пользователя',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    201: {
      description: 'Пользователь успешно зарегистрирован',
      ...jsonContent(successResponse(AuthDataSchema)),
    },
    400: errorResponse('Ошибка валидации'),
    409: errorResponse('Email уже занят'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Вход пользователя',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: { description: 'Успешный вход', ...jsonContent(successResponse(AuthDataSchema)) },
    400: errorResponse('Ошибка валидации'),
    401: errorResponse('Неверный email или пароль'),
    429: errorResponse('Аккаунт временно заблокирован из-за превышения попыток входа'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['Auth'],
  summary: 'Обновление пары токенов',
  request: { body: { content: { 'application/json': { schema: refreshSchema } } } },
  responses: {
    200: { description: 'Токены обновлены', ...jsonContent(successResponse(TokensSchema)) },
    400: errorResponse('Ошибка валидации'),
    401: errorResponse('Недействительный или истёкший refresh token'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Auth'],
  summary: 'Выход пользователя',
  description: 'Отзывает refresh token и, если передан, добавляет access token в чёрный список.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: logoutSchema } } } },
  responses: {
    200: { description: 'Выход выполнен успешно', ...jsonContent(successResponse(MessageSchema)) },
    400: errorResponse('Ошибка валидации'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Данные текущего пользователя',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Данные пользователя',
      ...jsonContent(successResponse(z.object({ user: SafeUserSchema }))),
    },
    401: errorResponse('Токен не предоставлен, недействителен или истёк'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/change-password',
  tags: ['Auth'],
  summary: 'Смена пароля',
  description: 'Меняет пароль и отзывает все выданные пользователю токены.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: changePasswordSchema } } } },
  responses: {
    200: { description: 'Пароль успешно изменён', ...jsonContent(successResponse(MessageSchema)) },
    400: errorResponse('Ошибка валидации'),
    401: errorResponse('Токен недействителен или неверный старый пароль'),
    404: errorResponse('Пользователь не найден'),
  },
});
