process.env.LOG_LEVEL = 'silent';

import { prisma } from '@/config/database';
import { valkey } from '@/config/valkey';

jest.setTimeout(15000);

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await valkey.flushdb();
});

afterAll(async () => {
  await prisma.$disconnect();
  await valkey.quit();
});
