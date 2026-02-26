/**
 * Per-worker setup: set DATABASE_URL so Prisma uses test DB.
 */
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';
