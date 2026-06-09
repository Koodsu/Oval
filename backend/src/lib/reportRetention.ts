import prisma from '../prisma';

const DEFAULT_REPORT_RETENTION_DAYS = 730;

function configuredRetentionDays(): number {
  const parsed = Number.parseInt(process.env.REPORT_RETENTION_DAYS ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REPORT_RETENTION_DAYS;
  return Math.min(3650, Math.max(30, parsed));
}

export async function deleteExpiredClosedReports(): Promise<number> {
  const cutoff = new Date(
    Date.now() - configuredRetentionDays() * 24 * 60 * 60 * 1000
  );
  const result = await prisma.report.deleteMany({
    where: {
      status: { in: ['RESOLVED', 'DISMISSED'] },
      resolvedAt: { lt: cutoff },
    },
  });
  return result.count;
}
