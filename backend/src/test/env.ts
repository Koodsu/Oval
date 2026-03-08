/**
 * Per-worker setup: point Prisma at the test database.
 */
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('TEST_DATABASE_URL must be set to run tests');
}
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;
process.env.NODE_ENV = 'test';
