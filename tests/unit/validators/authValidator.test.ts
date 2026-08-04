import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '@/validators/authValidator';

describe('registerSchema', () => {
  const valid = { email: 'user@example.com', password: 'Password123', name: 'Иван Иванов' };

  it('accepts valid input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Ab1' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a letter', () => {
    const result = registerSchema.safeParse({ ...valid, password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a digit', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'PasswordOnly' });
    expect(result.success).toBe(false);
  });

  it('rejects a name containing digits', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'Ivan123' });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 50 characters', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'A'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('accepts a Cyrillic name with spaces', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'Анна Мария Петрова' });
    expect(result.success).toBe(true);
  });

  it('strips unknown fields', () => {
    const result = registerSchema.safeParse({ ...valid, isAdmin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('isAdmin');
    }
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'anything' }).success).toBe(
      true,
    );
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'anything' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });

  it('rejects a missing password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('accepts a non-empty refresh token', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'token' }).success).toBe(true);
  });

  it('rejects an empty refresh token', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('rejects a missing refresh token', () => {
    expect(refreshSchema.safeParse({}).success).toBe(false);
  });
});

describe('logoutSchema', () => {
  it('accepts a non-empty refresh token', () => {
    expect(logoutSchema.safeParse({ refreshToken: 'token' }).success).toBe(true);
  });

  it('rejects an empty refresh token', () => {
    expect(logoutSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  const valid = { oldPassword: 'OldPassword1', newPassword: 'NewPassword2' };

  it('accepts valid input', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty old password', () => {
    expect(changePasswordSchema.safeParse({ ...valid, oldPassword: '' }).success).toBe(false);
  });

  it('rejects a weak new password (too short)', () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: 'short1' }).success).toBe(false);
  });

  it('rejects a new password without a digit', () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: 'NoDigitsHere' }).success).toBe(
      false,
    );
  });
});
