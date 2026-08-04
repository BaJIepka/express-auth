import {
  getTokenRemainingSeconds,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/utils/jwt';

describe('jwt utils', () => {
  describe('access tokens', () => {
    it('round-trips a valid payload', () => {
      const token = signAccessToken({ userId: 1, email: 'user@example.com' });
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe(1);
      expect(payload.email).toBe('user@example.com');
    });

    it('rejects a refresh token presented as an access token', () => {
      const refreshToken = signRefreshToken({ userId: 1 });
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });

    it('rejects garbage input', () => {
      expect(() => verifyAccessToken('not-a-jwt')).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('round-trips a valid payload', () => {
      const token = signRefreshToken({ userId: 42 });
      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe(42);
    });

    it('rejects an access token presented as a refresh token', () => {
      const accessToken = signAccessToken({ userId: 1, email: 'user@example.com' });
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it('generates unique tokens for repeated calls with the same payload', () => {
      const token1 = signRefreshToken({ userId: 1 });
      const token2 = signRefreshToken({ userId: 1 });
      expect(token1).not.toBe(token2);
    });
  });

  describe('getTokenRemainingSeconds', () => {
    it('returns a positive remaining time for a freshly issued token', () => {
      const token = signAccessToken({ userId: 1, email: 'user@example.com' });
      const remaining = getTokenRemainingSeconds(token);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(15 * 60);
    });

    it('returns 0 for a malformed token', () => {
      expect(getTokenRemainingSeconds('not-a-jwt')).toBe(0);
    });
  });
});
