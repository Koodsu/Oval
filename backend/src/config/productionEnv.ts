const REQUIRED_PRODUCTION_ENV = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CONTACT_EMAIL',
  'ADMIN_REPORTS_URL',
  'ADMIN_REVIEW_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'APPLE_TEAM_ID',
  'IOS_APP_ID',
] as const;

const SECRET_ENV = new Set([
  'JWT_SECRET',
  'CRON_SECRET',
  'ADMIN_REVIEW_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
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
    if (looksLikePlaceholder(value)) {
      errors.push(`${key} still contains a placeholder value`);
    }
    if (SECRET_ENV.has(key) && value.length < 32) {
      errors.push(`${key} must be at least 32 characters`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join('\n- ')}`);
  }
}
