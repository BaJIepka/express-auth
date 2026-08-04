import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../utils/logger';
import { env } from './env';

const dbUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ''),
  ...(dbUrl.port ? { port: Number(dbUrl.port) } : {}),
});

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ message: e.message }, 'Prisma warning');
});
