import Redis from 'ioredis';

import { logger } from '../utils/logger';
import { env } from './env';

export const VALKEY_CONFIG = {
  url: env.REDIS_URL,
  prefix: 'auth:',
};

export const valkey = new Redis(VALKEY_CONFIG.url, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  keyPrefix: VALKEY_CONFIG.prefix,
});

valkey.on('connect', () => {
  logger.info('Valkey connected');
});

valkey.on('error', (err: Error) => {
  logger.error({ err }, 'Valkey connection error');
});
