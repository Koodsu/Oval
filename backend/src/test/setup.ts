/**
 * Global setup: runs once before all tests.
 * Creates test DB, runs db push, seeds data.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function setup() {
  const backendDir = path.resolve(__dirname, '../..');

  const testDbPath = path.join(backendDir, 'prisma', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const env = { ...process.env, DATABASE_URL: 'file:./test.db' };

  execSync('npx prisma db push', {
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
