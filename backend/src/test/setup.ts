/**
 * Global setup: runs once before all tests.
 * Resets test DB schema and seeds data.
 *
 * NOTE: Vitest's globalSetup runs before .env loading, so we load it manually.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

function loadEnvFile(backendDir: string) {
  const envPath = path.join(backendDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export default function setup() {
  const backendDir = path.resolve(__dirname, '../..');

  loadEnvFile(backendDir);

  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL must be set to run tests');
  }

  const env = { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl };

  execSync('npx prisma migrate reset --force', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });

  execSync('npx prisma db seed', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });
}
