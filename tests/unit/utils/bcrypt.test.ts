import { comparePassword, hashPassword } from '@/utils/bcrypt';

describe('bcrypt utils', () => {
  it('hashes a password to a value different from the plaintext', async () => {
    const hash = await hashPassword('Password123');
    expect(hash).not.toBe('Password123');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces a different hash for the same password on each call (random salt)', async () => {
    const [hash1, hash2] = await Promise.all([
      hashPassword('Password123'),
      hashPassword('Password123'),
    ]);
    expect(hash1).not.toBe(hash2);
  });

  it('verifies a matching password', async () => {
    const hash = await hashPassword('Password123');
    await expect(comparePassword('Password123', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('Password123');
    await expect(comparePassword('WrongPassword1', hash)).resolves.toBe(false);
  });
});
