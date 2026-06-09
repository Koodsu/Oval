import type { SignOptions } from 'jsonwebtoken';

export const AUTH_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.AUTH_TOKEN_EXPIRES_IN?.trim() || '180d') as SignOptions['expiresIn'];
