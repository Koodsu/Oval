import { afterEach, describe, expect, it } from 'vitest';
import prisma from '../prisma';
import { consumeDurableRateLimit } from './durableRateLimit';

afterEach(async () => {
  delete process.env.TEST_DURABLE_RATE_LIMITS;
  await prisma.abuseEvent.deleteMany();
});

describe('durable rate limits', () => {
  it('persists attempts and blocks at the configured limit', async () => {
    process.env.TEST_DURABLE_RATE_LIMITS = 'true';
    const options = {
      action: `test_limit_${Date.now()}`,
      identifiers: ['person@example.com', '127.0.0.1'],
      limit: 2,
      windowMs: 60_000,
    };

    await expect(consumeDurableRateLimit(options)).resolves.toBe(true);
    await expect(consumeDurableRateLimit(options)).resolves.toBe(true);
    await expect(consumeDurableRateLimit(options)).resolves.toBe(false);
  });
});
