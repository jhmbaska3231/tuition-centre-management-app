// backend/src/modules/auth/tokens.ts
//
// access tokens are jwt. refresh and reset tokens are random bytes, only their
// sha256 hash is stored, so a database read never yields a usable token

import { createHash, randomBytes, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError } from '../../http/errors';
import { AccessTokenClaims } from './types';

const ISSUER = 'tuition-api';
const AUDIENCE = 'tuition-web';

export const signAccessToken = (claims: AccessTokenClaims): string =>
  jwt.sign(claims, config.auth.accessTokenSecret, {
    algorithm: 'HS256',
    expiresIn: config.auth.accessTokenTtl,
    issuer: ISSUER,
    audience: AUDIENCE,
  });

export const verifyAccessToken = (token: string): AccessTokenClaims => {
  try {
    const decoded = jwt.verify(token, config.auth.accessTokenSecret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as jwt.JwtPayload;

    if (typeof decoded.sub !== 'string' || typeof decoded.org !== 'string'
      || typeof decoded.role !== 'string' || typeof decoded.fam !== 'string') {
      throw new UnauthorizedError('Malformed token');
    }
    return { sub: decoded.sub, org: decoded.org, role: decoded.role as AccessTokenClaims['role'], fam: decoded.fam };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError('Token expired');
    throw new UnauthorizedError('Invalid token');
  }
};

export const newOpaqueToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const newFamilyId = (): string => randomUUID();