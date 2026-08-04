import { env, REFRESH_TOKEN_TTL_SECONDS } from '@/config/env';
import { valkey } from '@/config/valkey';

const KEYS = {
  loginAttempts: (email: string) => `login:attempts:${email}`,
  loginBlocked: (email: string) => `login:blocked:${email}`,
  refreshToken: (token: string) => `refresh:${token}`,
  blacklist: (token: string) => `blacklist:${token}`,
  rateLimiter: (ip: string) => `rate:${ip}`,
};

export const valkeyService = {
  async incrementLoginAttempts(email: string): Promise<number> {
    const key = KEYS.loginAttempts(email);
    const attempts = await valkey.incr(key);
    if (attempts === 1) {
      await valkey.expire(key, env.LOGIN_BLOCK_DURATION * 60);
    }
    return attempts;
  },

  async isLoginBlocked(email: string): Promise<boolean> {
    const exists = await valkey.exists(KEYS.loginBlocked(email));
    return exists === 1;
  },

  async blockLogin(email: string): Promise<void> {
    const ttl = env.LOGIN_BLOCK_DURATION * 60;
    await valkey.setex(KEYS.loginBlocked(email), ttl, '1');
  },

  async resetLoginAttempts(email: string): Promise<void> {
    await valkey.del(KEYS.loginAttempts(email), KEYS.loginBlocked(email));
  },

  async storeRefreshToken(token: string, userId: number): Promise<void> {
    await valkey.setex(KEYS.refreshToken(token), REFRESH_TOKEN_TTL_SECONDS, String(userId));
  },

  // Atomically reads and deletes the token in one round trip (MULTI/EXEC), so two
  // concurrent refresh requests for the same token can't both observe it as valid.
  async consumeRefreshToken(token: string): Promise<number | null> {
    const key = KEYS.refreshToken(token);
    const results = await valkey.multi().get(key).del(key).exec();
    const val = results?.[0]?.[1] as string | null;
    return val ? parseInt(val, 10) : null;
  },

  async deleteRefreshToken(token: string): Promise<void> {
    await valkey.del(KEYS.refreshToken(token));
  },

  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds > 0) {
      await valkey.setex(KEYS.blacklist(token), ttlSeconds, '1');
    }
  },

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const exists = await valkey.exists(KEYS.blacklist(token));
    return exists === 1;
  },

  async checkRateLimit(
    ip: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = KEYS.rateLimiter(ip);
    const requests = await valkey.incr(key);
    if (requests === 1) {
      await valkey.expire(key, windowSeconds);
    }
    const ttl = await valkey.ttl(key);
    return {
      allowed: requests <= maxRequests,
      remaining: Math.max(0, maxRequests - requests),
      resetIn: ttl,
    };
  },
};
