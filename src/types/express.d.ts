import type { SafeUser } from '@/utils/sanitizeUser';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      token?: string;
    }
  }
}

export {};
