import crypto from 'crypto';
import { getJwtSecret } from '../config/jwt';

export type OneTimeCodePurpose = 'email-verification' | 'password-reset';

export function generateOneTimeCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOneTimeCode(purpose: OneTimeCodePurpose, code: string): string {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${purpose}:${code}`)
    .digest('hex');
}

export function oneTimeCodeMatches(
  purpose: OneTimeCodePurpose,
  candidate: string,
  expectedHash: string
): boolean {
  const actual = Buffer.from(hashOneTimeCode(purpose, candidate), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
