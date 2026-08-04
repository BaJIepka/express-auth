jest.mock('@/config/valkey', () => ({
  valkey: {
    incr: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    multi: jest.fn(),
  },
}));

import { REFRESH_TOKEN_TTL_SECONDS } from '@/config/env';
import { valkey } from '@/config/valkey';
import { valkeyService } from '@/services/valkeyService';

const mockValkey = valkey as unknown as {
  incr: jest.Mock;
  expire: jest.Mock;
  exists: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  ttl: jest.Mock;
  multi: jest.Mock;
};

describe('valkeyService', () => {
  describe('incrementLoginAttempts', () => {
    it('sets an expiry only on the first attempt', async () => {
      mockValkey.incr.mockResolvedValue(1);
      const attempts = await valkeyService.incrementLoginAttempts('user@example.com');
      expect(attempts).toBe(1);
      expect(mockValkey.incr).toHaveBeenCalledWith('login:attempts:user@example.com');
      expect(mockValkey.expire).toHaveBeenCalledWith('login:attempts:user@example.com', 15 * 60);
    });

    it('does not reset the expiry on subsequent attempts', async () => {
      mockValkey.incr.mockResolvedValue(2);
      const attempts = await valkeyService.incrementLoginAttempts('user@example.com');
      expect(attempts).toBe(2);
      expect(mockValkey.expire).not.toHaveBeenCalled();
    });
  });

  describe('isLoginBlocked', () => {
    it('returns true when the block key exists', async () => {
      mockValkey.exists.mockResolvedValue(1);
      await expect(valkeyService.isLoginBlocked('user@example.com')).resolves.toBe(true);
      expect(mockValkey.exists).toHaveBeenCalledWith('login:blocked:user@example.com');
    });

    it('returns false when the block key does not exist', async () => {
      mockValkey.exists.mockResolvedValue(0);
      await expect(valkeyService.isLoginBlocked('user@example.com')).resolves.toBe(false);
    });
  });

  it('blockLogin sets the block key with the configured TTL', async () => {
    await valkeyService.blockLogin('user@example.com');
    expect(mockValkey.setex).toHaveBeenCalledWith('login:blocked:user@example.com', 15 * 60, '1');
  });

  it('resetLoginAttempts deletes both attempt and block keys', async () => {
    await valkeyService.resetLoginAttempts('user@example.com');
    expect(mockValkey.del).toHaveBeenCalledWith(
      'login:attempts:user@example.com',
      'login:blocked:user@example.com',
    );
  });

  it('storeRefreshToken stores the userId under the token key with the configured TTL', async () => {
    await valkeyService.storeRefreshToken('rt-abc', 42);
    expect(mockValkey.setex).toHaveBeenCalledWith(
      'refresh:rt-abc',
      REFRESH_TOKEN_TTL_SECONDS,
      '42',
    );
  });

  describe('consumeRefreshToken', () => {
    it('returns the parsed userId when the token exists', async () => {
      const exec = jest.fn().mockResolvedValue([
        [null, '123'],
        [null, 1],
      ]);
      const del = jest.fn().mockReturnValue({ exec });
      const get = jest.fn().mockReturnValue({ del });
      mockValkey.multi.mockReturnValue({ get });

      const result = await valkeyService.consumeRefreshToken('rt-abc');

      expect(result).toBe(123);
      expect(get).toHaveBeenCalledWith('refresh:rt-abc');
      expect(del).toHaveBeenCalledWith('refresh:rt-abc');
    });

    it('returns null when the token does not exist', async () => {
      const exec = jest.fn().mockResolvedValue([
        [null, null],
        [null, 0],
      ]);
      const del = jest.fn().mockReturnValue({ exec });
      const get = jest.fn().mockReturnValue({ del });
      mockValkey.multi.mockReturnValue({ get });

      const result = await valkeyService.consumeRefreshToken('rt-missing');
      expect(result).toBeNull();
    });
  });

  it('deleteRefreshToken deletes the token key', async () => {
    await valkeyService.deleteRefreshToken('rt-abc');
    expect(mockValkey.del).toHaveBeenCalledWith('refresh:rt-abc');
  });

  describe('blacklistToken', () => {
    it('stores the token when the TTL is positive', async () => {
      await valkeyService.blacklistToken('at-abc', 60);
      expect(mockValkey.setex).toHaveBeenCalledWith('blacklist:at-abc', 60, '1');
    });

    it('does nothing when the TTL is zero or negative', async () => {
      await valkeyService.blacklistToken('at-abc', 0);
      await valkeyService.blacklistToken('at-abc', -5);
      expect(mockValkey.setex).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('returns true when the blacklist key exists', async () => {
      mockValkey.exists.mockResolvedValue(1);
      await expect(valkeyService.isTokenBlacklisted('at-abc')).resolves.toBe(true);
      expect(mockValkey.exists).toHaveBeenCalledWith('blacklist:at-abc');
    });

    it('returns false when the blacklist key does not exist', async () => {
      mockValkey.exists.mockResolvedValue(0);
      await expect(valkeyService.isTokenBlacklisted('at-abc')).resolves.toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    it('sets an expiry only on the first request within the window', async () => {
      mockValkey.incr.mockResolvedValue(1);
      mockValkey.ttl.mockResolvedValue(60);

      const result = await valkeyService.checkRateLimit('1.2.3.4', 100, 60);

      expect(mockValkey.expire).toHaveBeenCalledWith('rate:1.2.3.4', 60);
      expect(result).toEqual({ allowed: true, remaining: 99, resetIn: 60 });
    });

    it('reports not allowed once the request count exceeds the max', async () => {
      mockValkey.incr.mockResolvedValue(101);
      mockValkey.ttl.mockResolvedValue(10);

      const result = await valkeyService.checkRateLimit('1.2.3.4', 100, 60);

      expect(result).toEqual({ allowed: false, remaining: 0, resetIn: 10 });
      expect(mockValkey.expire).not.toHaveBeenCalled();
    });
  });
});
