import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { valkey } from '@/config/valkey';
import { logger } from '@/utils/logger';

import { app } from './app';

async function main(): Promise<void> {
  try {
    await valkey.connect();
    await prisma.$connect();

    logger.info('Connected to MySQL and Valkey');

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    async function shutdown(): Promise<void> {
      logger.info('Shutting down gracefully...');
      server.close();
      await prisma.$disconnect();
      valkey.disconnect();
      process.exit(0);
    }

    process.on('SIGTERM', () => void shutdown());
    process.on('SIGINT', () => void shutdown());
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

void main();
