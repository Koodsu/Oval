const REQUIRED_PRODUCTION_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const SECRET_ENV = new Set([
  'JWT_SECRET',
  'CRON_SECRET',
  'ADMIN_REVIEW_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
]);

function looksLikePlaceholder(value: string): boolean {
  return /change_me|your_|example|placeholder|\[project|localhost/i.test(value);
}

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV !== 'production') return;

  const errors: string[] = [];
  for (const key of REQUIRED_PRODUCTION_ENV) {
    const value = env[key]?.trim() ?? '';
    if (!value) {
      errors.push(`${key} is missing`);
      continue;
    }
  }

  for (const key of SECRET_ENV) {
    const value = env[key]?.trim() ?? '';
    if (!value) continue;
    if (looksLikePlaceholder(value)) {
      errors.push(`${key} still contains a placeholder value`);
    }
    if (value.length < 32) {
      errors.push(`${key} must be at least 32 characters`);
    }
  }

  const androidFingerprint = env.ANDROID_SHA256_CERT_FINGERPRINT?.trim();
  if (androidFingerprint && !/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(androidFingerprint)) {
    errors.push('ANDROID_SHA256_CERT_FINGERPRINT must be a colon-delimited SHA-256 fingerprint');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join('\n- ')}`);
  }

  // Soft warnings: these degrade optional features rather than breaking the
  // app, which makes the failure invisible in testing — say so in the logs.
  if (!androidFingerprint) {
    console.warn(
      '[env] ANDROID_SHA256_CERT_FINGERPRINT is not set — Android App Links cannot verify ' +
        'until the Play App Signing certificate fingerprint is configured.',
    );
  }
}
