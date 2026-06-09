import jwt from 'jsonwebtoken';
import { AUTH_TOKEN_EXPIRES_IN } from '../config/authTokens';
import { getJwtSecret } from '../config/jwt';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

export function issueAuthToken(user: { id: string; email: string; tokenVersion: number }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    },
    getJwtSecret(),
    { expiresIn: AUTH_TOKEN_EXPIRES_IN }
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}
