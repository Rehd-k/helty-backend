/**
 * JWT secret resolution for Nest auth modules.
 *
 * Production must never fall back to example / placeholder secrets.
 */

const WEAK_JWT_SECRETS = new Set([
  '',
  'hard-to-guess-secret',
  'this_is_the_best_kept_secerte',
]);

export function isWeakJwtSecret(secret: string | undefined | null): boolean {
  const trimmed = (secret ?? '').trim();
  return WEAK_JWT_SECRETS.has(trimmed);
}

/**
 * Returns a usable JWT secret.
 * @throws if NODE_ENV=production and the secret is missing or weak
 */
export function resolveJwtSecret(
  raw: string | undefined | null,
  options?: { nodeEnv?: string },
): string {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const secret = (raw ?? '').trim();
  const production = nodeEnv === 'production';

  if (production && isWeakJwtSecret(secret)) {
    throw new Error(
      'JWT_SECRET must be set to a strong, unique value in production. ' +
        'Do not reuse the hospital secret or .env.example defaults. ' +
        'Each Coolify / org deployment needs its own JWT_SECRET.',
    );
  }

  if (!secret) {
    return 'hard-to-guess-secret';
  }

  return secret;
}

/** Call once during bootstrap before Nest listens. */
export function assertProductionJwtSecretConfigured(): void {
  resolveJwtSecret(process.env.JWT_SECRET);
}
