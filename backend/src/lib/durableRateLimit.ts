import crypto from 'crypto';
import prisma from '../prisma';

interface ConsumeRateLimitOptions {
  action: string;
  identifiers: string[];
  limit: number;
  windowMs: number;
}

function hashIdentifier(action: string, identifier: string): string {
  return crypto.createHash('sha256').update(`${action}:${identifier}`).digest('hex');
}

export async function consumeDurableRateLimit({
  action,
  identifiers,
  limit,
  windowMs,
}: ConsumeRateLimitOptions): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && process.env.TEST_DURABLE_RATE_LIMITS !== 'true') {
    return true;
  }

  const uniqueIdentifiers = Array.from(
    new Set(identifiers.map((value) => value.trim()).filter(Boolean))
  ).map((value) => hashIdentifier(action, value));

  if (uniqueIdentifiers.length === 0) return true;

  const since = new Date(Date.now() - windowMs);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const counts = await Promise.all(
          uniqueIdentifiers.map((identifier) =>
            tx.abuseEvent.count({ where: { action, identifier, createdAt: { gt: since } } })
          )
        );

        if (counts.some((count) => count >= limit)) return false;

        await tx.abuseEvent.createMany({
          data: uniqueIdentifiers.map((identifier) => ({ action, identifier })),
        });
        return true;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'P2034' || attempt === 2) throw error;
    }
  }
  return false;
}

export async function deleteExpiredAbuseEvents(retentionMs = 48 * 60 * 60 * 1000): Promise<number> {
  const result = await prisma.abuseEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - retentionMs) } },
  });
  return result.count;
}
