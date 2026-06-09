import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function runPrisma(args, databaseUrl) {
  execFileSync('npx', ['prisma', ...args], {
    cwd: path.resolve('backend'),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
    stdio: 'inherit',
  });
}

const FIRST_RELEASE_MIGRATION = '20260601120000_launch_ops_password_resets_analytics';

function verifyProductionUpgrade(databaseUrl) {
  runPrisma([
    'db',
    'push',
    '--force-reset',
    '--skip-generate',
    '--schema',
    'prisma/production-baseline.prisma',
  ], databaseUrl);

  const migrations = fs.readdirSync(path.resolve('backend/prisma/migrations'))
    .filter((name) => fs.statSync(path.resolve('backend/prisma/migrations', name)).isDirectory())
    .sort();
  for (const migration of migrations.filter((name) => name < FIRST_RELEASE_MIGRATION)) {
    runPrisma(['migrate', 'resolve', '--applied', migration], databaseUrl);
  }

  runPrisma(['migrate', 'deploy'], databaseUrl);
  runPrisma([
    'migrate',
    'diff',
    '--from-url',
    databaseUrl,
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--exit-code',
  ], databaseUrl);
}

function assertDisposableDatabase(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (!local || !parsed.pathname.toLowerCase().includes('test')) {
    throw new Error('TEST_DATABASE_URL must point to a local database with "test" in its name');
  }
}

const configuredTestUrl = process.env.TEST_DATABASE_URL?.trim();
if (configuredTestUrl) {
  assertDisposableDatabase(configuredTestUrl);
  verifyProductionUpgrade(configuredTestUrl);
  console.log('[migrations] production upgrade path matches the current schema');
  process.exit(0);
}

const port = String(56432 + (process.pid % 1000));
const dataDir = path.join(os.tmpdir(), `bridge-migration-check-${process.pid}`);
const logPath = path.join(dataDir, 'postgres.log');
const databaseUrl = `postgresql://postgres@localhost:${port}/bridge_migration_test`;

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

try {
  execFileSync('initdb', ['-D', dataDir, '-A', 'trust', '-U', 'postgres'], { stdio: 'ignore' });
  execFileSync('pg_ctl', ['-D', dataDir, '-l', logPath, '-o', `-p ${port}`, '-w', 'start'], { stdio: 'ignore' });
  execFileSync('createdb', ['-h', 'localhost', '-p', port, '-U', 'postgres', 'bridge_migration_test'], { stdio: 'ignore' });
  verifyProductionUpgrade(databaseUrl);
  console.log('[migrations] production upgrade path matches the current schema');
} finally {
  try {
    execFileSync('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
  } catch {
    // The server may not have started.
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
