/**
 * Returns the JWT secret from the environment.
 * Throws at startup in every environment except test — fail fast
 * rather than silently running with a known fallback secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'bridge_test_secret_do_not_use_in_prod';
    }
    throw new Error(
      'JWT_SECRET environment variable is required. Add it to your .env file.\n' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }

  return secret;
}
