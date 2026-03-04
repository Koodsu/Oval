/**
 * Returns the JWT secret from the environment.
 * Logs a warning in development if the secret is not set;
 * throws in production so the server fails fast rather than
 * running with a publicly-known fallback secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn(
      '[bridge] WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET in your .env file.'
    );
    return 'bridge_dev_secret';
  }

  return secret;
}
