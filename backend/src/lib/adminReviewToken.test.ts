import { afterEach, describe, expect, it } from 'vitest';
import { createAdminReviewToken, verifyAdminReviewToken } from './adminReviewToken';

const originalSecret = process.env.ADMIN_REVIEW_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ADMIN_REVIEW_SECRET;
  else process.env.ADMIN_REVIEW_SECRET = originalSecret;
});

describe('admin review tokens', () => {
  it('validates a current report-specific token', () => {
    process.env.ADMIN_REVIEW_SECRET = 'a-long-test-review-secret';
    const signed = createAdminReviewToken('report-1', 1000);

    expect(signed).not.toBeNull();
    expect(verifyAdminReviewToken('report-1', signed!.expires, signed!.token, 2000)).toBe(true);
    expect(verifyAdminReviewToken('report-2', signed!.expires, signed!.token, 2000)).toBe(false);
  });

  it('rejects expired tokens', () => {
    process.env.ADMIN_REVIEW_SECRET = 'a-long-test-review-secret';
    const signed = createAdminReviewToken('report-1', 1000)!;

    expect(verifyAdminReviewToken('report-1', signed.expires, signed.token, signed.expires + 1)).toBe(false);
  });
});
