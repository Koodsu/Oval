import crypto from 'crypto';

const REVIEW_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getReviewSecret(): string | null {
  return process.env.ADMIN_REVIEW_SECRET?.trim() || null;
}

function signature(reportId: string, expires: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${reportId}.${expires}`)
    .digest('hex');
}

export function createAdminReviewToken(
  reportId: string,
  now = Date.now()
): { expires: number; token: string } | null {
  const secret = getReviewSecret();
  if (!secret) return null;
  const expires = now + REVIEW_LINK_TTL_MS;
  return { expires, token: signature(reportId, expires, secret) };
}

export function verifyAdminReviewToken(
  reportId: string,
  expiresValue: unknown,
  tokenValue: unknown,
  now = Date.now()
): boolean {
  const secret = getReviewSecret();
  if (!secret || typeof tokenValue !== 'string') return false;

  const expires = typeof expiresValue === 'string' ? Number(expiresValue) : expiresValue;
  if (typeof expires !== 'number' || !Number.isSafeInteger(expires) || expires < now) return false;

  const expected = Buffer.from(signature(reportId, expires, secret));
  const actual = Buffer.from(tokenValue);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
