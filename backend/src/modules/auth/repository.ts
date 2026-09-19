// backend/src/modules/auth/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import { AuthSessionRow, Role, UserRow } from './types';

// users ---------------------------------------------------------------------

export const findUserByEmail = (q: Queryable, orgId: string, email: string) =>
  maybeOne<UserRow>(q,
    'SELECT * FROM users WHERE org_id = $1 AND lower(email) = lower($2)',
    [orgId, email]);

export const findUserById = (q: Queryable, orgId: string, id: string) =>
  maybeOne<UserRow>(q, 'SELECT * FROM users WHERE org_id = $1 AND id = $2', [orgId, id]);

export interface CreateUserInput {
  orgId: string;
  email: string;
  passwordHash: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export const insertUser = (q: Queryable, u: CreateUserInput) =>
  one<UserRow>(q,
    `INSERT INTO users (org_id, email, password_hash, role, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [u.orgId, u.email, u.passwordHash, u.role, u.firstName, u.lastName, u.phone]);

export const touchLastLogin = (q: Queryable, userId: string) =>
  execute(q, 'UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);

export const updatePasswordHash = (q: Queryable, userId: string, passwordHash: string) =>
  execute(q, 'UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);

// one query for authenticate: the user must be live, the token's session family must
// still have an unrevoked unexpired row, and branch scope comes along for free
export interface AuthLookupRow {
  id: string;
  org_id: string;
  role: Role;
  email: string;
  first_name: string;
  last_name: string;
  branch_ids: string[];
}

export const findAuthenticatedUser = (q: Queryable, orgId: string, userId: string, familyId: string) =>
  maybeOne<AuthLookupRow>(q,
    `SELECT u.id, u.org_id, u.role, u.email, u.first_name, u.last_name,
            COALESCE(array_agg(ub.branch_id) FILTER (WHERE ub.branch_id IS NOT NULL), '{}') AS branch_ids
     FROM users u
     LEFT JOIN user_branches ub ON ub.user_id = u.id
     WHERE u.org_id = $1 AND u.id = $2 AND u.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM auth_sessions s
         WHERE s.user_id = u.id AND s.family_id = $3
           AND s.revoked_at IS NULL AND s.expires_at > now()
       )
     GROUP BY u.id`,
    [orgId, userId, familyId]);

// sessions ---------------------------------------------------------------------

export interface CreateSessionInput {
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export const insertSession = (q: Queryable, s: CreateSessionInput) =>
  one<AuthSessionRow>(q,
    `INSERT INTO auth_sessions (user_id, family_id, refresh_token_hash, expires_at, ip, user_agent, last_used_at)
     VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
    [s.userId, s.familyId, s.refreshTokenHash, s.expiresAt, s.ip, s.userAgent]);

// locked so two concurrent refreshes with the same token serialise
export const findSessionByHashForUpdate = (q: Queryable, hash: string) =>
  maybeOne<AuthSessionRow>(q,
    'SELECT * FROM auth_sessions WHERE refresh_token_hash = $1 FOR UPDATE',
    [hash]);

export const markSessionReplaced = (q: Queryable, oldId: string, newId: string) =>
  execute(q,
    'UPDATE auth_sessions SET replaced_by_id = $2, revoked_at = now() WHERE id = $1',
    [oldId, newId]);

export const revokeFamily = (q: Queryable, familyId: string) =>
  execute(q,
    'UPDATE auth_sessions SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
    [familyId]);

export const revokeAllForUser = (q: Queryable, userId: string) =>
  execute(q,
    'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]);

// password reset ---------------------------------------------------------------------

export const insertResetToken = (q: Queryable, userId: string, tokenHash: string, expiresAt: Date) =>
  execute(q,
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]);

export interface ResetTokenRow {
  id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

export const findResetTokenForUpdate = (q: Queryable, tokenHash: string) =>
  maybeOne<ResetTokenRow>(q,
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1 FOR UPDATE',
    [tokenHash]);

export const markResetTokenUsed = (q: Queryable, id: string) =>
  execute(q, 'UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [id]);