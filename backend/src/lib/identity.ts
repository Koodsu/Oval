import crypto from 'crypto';
import { getJwtSecret } from '../config/jwt';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmailIdentity(email: string): string {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(normalizeEmail(email))
    .digest('hex');
}
