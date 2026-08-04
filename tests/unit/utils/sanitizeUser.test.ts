import { toSafeUser } from '@/utils/sanitizeUser';

describe('toSafeUser', () => {
  it('strips the password field', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const user = {
      id: 1,
      email: 'user@example.com',
      password: 'super-secret-hash',
      name: 'Иван Иванов',
      createdAt,
      updatedAt: new Date(),
    };

    const safeUser = toSafeUser(user);

    expect(safeUser).toEqual({
      id: 1,
      email: 'user@example.com',
      name: 'Иван Иванов',
      createdAt,
    });
    expect(safeUser).not.toHaveProperty('password');
  });
});
