/**
 * Global setup: runs once before all tests.
 * Resets test DB schema and seeds data.
 *
 * NOTE: Vitest's globalSetup runs before .env loading, so we load it manually.
 */
import { execFileSync, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

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

function isDatabaseReachable(databaseUrl: string, backendDir: string): boolean {
  try {
    execFileSync(
      'npx',
      ['prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'],
      {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
        input: 'SELECT 1;',
        stdio: ['pipe', 'ignore', 'ignore'],
      }
    );
    return true;
  } catch {
    return false;
  }
}

function startEphemeralPostgres(): { url: string; teardown: () => void } {
  const port = String(55432 + (process.pid % 1000));
  const dataDir = path.join(os.tmpdir(), `bridge-postgres-test-${process.pid}`);
  const logPath = path.join(dataDir, 'postgres.log');
  const dbName = 'bridge_test';

  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  execFileSync('initdb', ['-D', dataDir, '-A', 'trust', '-U', 'postgres'], { stdio: 'ignore' });
  execFileSync('pg_ctl', ['-D', dataDir, '-l', logPath, '-o', `-p ${port}`, '-w', 'start'], { stdio: 'ignore' });
  execFileSync('createdb', ['-h', 'localhost', '-p', port, '-U', 'postgres', dbName], { stdio: 'ignore' });

  return {
    url: `postgresql://postgres@localhost:${port}/${dbName}`,
    teardown: () => {
      try {
        execFileSync('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
      } catch {
        // best-effort cleanup
      }
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export default function setup() {
  const backendDir = path.resolve(__dirname, '../..');

  loadEnvFile(backendDir);

  let teardown: (() => void) | undefined;
  let testDbUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testDbUrl || !isDatabaseReachable(testDbUrl, backendDir)) {
    const ephemeral = startEphemeralPostgres();
    testDbUrl = ephemeral.url;
    teardown = ephemeral.teardown;
  }
  process.env.TEST_DATABASE_URL = testDbUrl;

  const env = { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl };

  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      cwd: backendDir,
      env,
      stdio: 'inherit',
    });

    execSync('npx prisma db seed', {
      cwd: backendDir,
      env,
      stdio: 'inherit',
    });
  } catch (err) {
    teardown?.();
    throw err;
  }

  return () => {
    teardown?.();
  };
}
