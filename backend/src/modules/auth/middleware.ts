// backend/src/modules/auth/middleware.ts
//
// authenticate: bearer token > req.user, or 401
// authorise: req.user.role must be one of the given roles, or 403

import { NextFunction, Request, Response } from 'express';
import { pool } from '../../db';
import { ForbiddenError, UnauthorizedError } from '../../http/errors';
import { findAuthenticatedUser } from './repository';
import { verifyAccessToken } from './tokens';
import { AuthUser, Role } from './types';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new UnauthorizedError('Access token required'));
    return;
  }

  const claims = verifyAccessToken(token);
  const row = await findAuthenticatedUser(pool, claims.org, claims.sub, claims.fam);
  if (!row) {
    next(new UnauthorizedError('Session is no longer valid'));
    return;
  }
  if (row.role !== claims.role) {
    // role changed since the token was issued, force a refresh to pick it up
    next(new UnauthorizedError('Token out of date'));
    return;
  }

  req.user = {
    id: row.id, orgId: row.org_id, role: row.role, email: row.email,
    firstName: row.first_name, lastName: row.last_name, familyId: claims.fam, branchIds: row.branch_ids,
  };
  next();
};

export const authorise = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      console.warn(JSON.stringify({
        level: 'warn', msg: 'authorisation_denied', requestId: req.id, userId: req.user.id,
        role: req.user.role, required: roles, path: req.originalUrl,
      }));
      next(new ForbiddenError());
      return;
    }
    next();
  };

// helper for services: admins see all branches, branch managers see only theirs
export const canAccessBranch = (user: AuthUser, branchId: string): boolean =>
  user.role === 'admin' || user.branchIds.includes(branchId);

// narrow req.user for handlers that run after authenticate
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};