import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./src/test/setup.ts'],
    setupFiles: ['./src/test/env.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    testTimeout: 10000,
    retry: 1,
    pool: 'forks', // Run in forks to avoid DB lock from parallel workers
    fileParallelism: false, // Integration specs share one test DB; keep files isolated from each other.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
