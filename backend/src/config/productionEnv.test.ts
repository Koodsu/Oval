import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from './productionEnv';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://bridge:password@db.internal/bridge',
  DIRECT_URL: 'postgresql://bridge:password@db.internal/bridge',
  JWT_SECRET: 'j'.repeat(64),
  CORS_ORIGIN: 'https://www.joinbridgeapp.com',
  CRON_SECRET: 'c'.repeat(64),
  RESEND_API_KEY: 're_1234567890',
  RESEND_FROM_EMAIL: 'noreply@joinbridgeapp.com',
  CONTACT_EMAIL: 'contactus@joinbridgeapp.com',
  ADMIN_REPORTS_URL: 'https://api.joinbridgeapp.com/admin/reports/review',
  ADMIN_REVIEW_SECRET: 'a'.repeat(64),
  SUPABASE_URL: 'https://bridge.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(64),
  OPENAI_API_KEY: 'o'.repeat(64),
  APPLE_TEAM_ID: '687FPU46UV',
  IOS_APP_ID: 'com.bradyvb.bridgeapp',
};

describe('production environment validation', () => {
  it('accepts a complete production environment', () => {
    expect(() => validateProductionEnvironment(validEnv)).not.toThrow();
  });

  it('allows optional integrations to be absent', () => {
    expect(() => validateProductionEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
      CORS_ORIGIN: validEnv.CORS_ORIGIN,
    })).not.toThrow();
  });

  it('rejects missing core values and invalid configured secrets', () => {
    expect(() => validateProductionEnvironment({
      ...validEnv,
      DATABASE_URL: undefined,
      JWT_SECRET: 'change_me',
      OPENAI_API_KEY: undefined,
    })).toThrow(/DATABASE_URL is missing|JWT_SECRET still contains a placeholder/);
  });

  it('does nothing outside production', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'test' })).not.toThrow();
  });
});
