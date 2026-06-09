import { describe, expect, it } from 'vitest';
import prisma from '../prisma';
import { createTestUser } from '../test/helpers';
import { deleteExpiredClosedReports } from './reportRetention';

describe('report retention', () => {
  it('deletes only closed reports past the retention period', async () => {
    const reporter = await createTestUser({ email: `retention-${Date.now()}@osu.edu` });
    const oldDate = new Date(Date.now() - 731 * 24 * 60 * 60 * 1000);

    const expired = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: 'USER',
        reason: 'SPAM',
        status: 'RESOLVED',
        resolvedAt: oldDate,
      },
    });
    const open = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: 'USER',
        reason: 'SPAM',
        status: 'OPEN',
        createdAt: oldDate,
      },
    });

    expect(await deleteExpiredClosedReports()).toBe(1);
    expect(await prisma.report.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.report.findUnique({ where: { id: open.id } })).not.toBeNull();
  });
});
