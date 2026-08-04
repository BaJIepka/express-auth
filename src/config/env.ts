import dotenv from 'dotenv';
import { z } from 'zod';

import { parseDurationToSeconds } from '../utils/duration';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET должен быть не короче 32 символов'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_BLOCK_DURATION: z.coerce.number().default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsed.error.flatten(), null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const REFRESH_TOKEN_TTL_SECONDS = parseDurationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN);
