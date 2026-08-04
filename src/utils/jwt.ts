import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { env } from '@/config/env';

export interface AccessTokenPayload {
  userId: number;
  email: string;
}

export interface RefreshTokenPayload {
  userId: number;
}

type TokenType = 'access' | 'refresh';

function signToken(payload: object, type: TokenType, expiresIn: string): string {
  return jwt.sign({ ...payload, type }, env.JWT_SECRET, {
    expiresIn: expiresIn as NonNullable<jwt.SignOptions['expiresIn']>,
  });
}

function verifyToken<T>(token: string, type: TokenType): T {
  const decoded = jwt.verify(token, env.JWT_SECRET) as T & { type?: TokenType };
  if (decoded.type !== type) {
    throw new Error(`Invalid token type: expected "${type}"`);
  }
  return decoded;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return signToken(payload, 'access', env.ACCESS_TOKEN_EXPIRES_IN);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verifyToken<AccessTokenPayload>(token, 'access');
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  // jti makes the token unique even when two are issued for the same user within
  // the same second (iat/exp are second-precision), which would otherwise produce
  // byte-identical JWTs and collide on RefreshToken.token's unique constraint.
  return signToken({ ...payload, jti: randomUUID() }, 'refresh', env.REFRESH_TOKEN_EXPIRES_IN);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return verifyToken<RefreshTokenPayload>(token, 'refresh');
}

export function getTokenRemainingSeconds(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) return 0;
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}
