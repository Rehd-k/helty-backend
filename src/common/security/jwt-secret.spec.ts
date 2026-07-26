import {
  assertProductionJwtSecretConfigured,
  isWeakJwtSecret,
  resolveJwtSecret,
} from './jwt-secret';

describe('jwt-secret', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('detects example defaults as weak', () => {
    expect(isWeakJwtSecret('hard-to-guess-secret')).toBe(true);
    expect(isWeakJwtSecret('this_is_the_best_kept_secerte')).toBe(true);
    expect(isWeakJwtSecret('')).toBe(true);
    expect(isWeakJwtSecret('a-real-unique-org-secret')).toBe(false);
  });

  it('allows weak fallback outside production', () => {
    expect(resolveJwtSecret(undefined, { nodeEnv: 'development' })).toBe(
      'hard-to-guess-secret',
    );
  });

  it('throws in production when secret missing or weak', () => {
    expect(() =>
      resolveJwtSecret(undefined, { nodeEnv: 'production' }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      resolveJwtSecret('hard-to-guess-secret', { nodeEnv: 'production' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepts a strong secret in production', () => {
    expect(
      resolveJwtSecret('org-specific-strong-secret', { nodeEnv: 'production' }),
    ).toBe('org-specific-strong-secret');
  });

  it('assertProductionJwtSecretConfigured reads process.env', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'org-specific-strong-secret';
    expect(() => assertProductionJwtSecretConfigured()).not.toThrow();

    process.env.JWT_SECRET = 'hard-to-guess-secret';
    expect(() => assertProductionJwtSecretConfigured()).toThrow(/JWT_SECRET/);
  });
});
