// backend/src/modules/auth/service.ts

import bcrypt from 'bcrypt';
import { config } from '../../config';
import { isUniqueViolation, pool, withTransaction } from '../../db';
import { ConflictError, UnauthorizedError } from '../../http/errors';
import { getCurrentOrgId } from '../org/current-org';
import * as repo from './repository';
import type { LoginInput, RegisterInput } from '@tuition/shared';
import { hashToken, newFamilyId, newOpaqueToken, signAccessToken } from './tokens';
import { PublicUser, toPublicUser, UserRow } from './types';
import { writeAudit } from '../audit/writer';
import { enqueue } from '../notifications/outbox';

const BCRYPT_COST = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// two tabs refreshing within this window: the loser gets a 401 and retries with the
// cookie the winner just set, and the family is not revoked
const ROTATION_GRACE_MS = 10_000;

// a real hash compared against when the email is unknown, so login timing does not
// reveal whether an account exists
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_COST);

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

const issueSession = async (user: UserRow, familyId: string, meta: RequestMeta): Promise<IssuedSession> => {
  const refreshToken = newOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + config.auth.refreshTokenTtlMs);
  await withTransaction(async tx => {
    await repo.insertSession(tx, {
      userId: user.id, familyId, refreshTokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt,
      ip: meta.ip, userAgent: meta.userAgent,
    });
    await repo.touchLastLogin(tx, user.id);
  });
  const accessToken = signAccessToken({ sub: user.id, org: user.org_id, role: user.role, fam: familyId });
  return { accessToken, refreshToken, refreshExpiresAt, user: toPublicUser(user) };
};

export const register = async (input: RegisterInput, meta: RequestMeta): Promise<IssuedSession> => {
  const orgId = await getCurrentOrgId();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  let user: UserRow;
  try {
    user = await withTransaction(async tx => {
      const created = await repo.insertUser(tx, {
        orgId, email: input.email, passwordHash, role: 'parent',
        firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null,
      });
      await writeAudit(tx, {
        orgId, actorUserId: created.id, action: 'user.registered', entityType: 'user', entityId: created.id,
        after: { email: created.email, role: created.role }, ip: meta.ip,
      });
      await enqueue(tx, {
        orgId, recipientUserId: created.id, eventKey: 'account_created', template: 'account_created_v1',
        payload: { firstName: created.first_name }, dedupeKey: `account_created:${created.id}`,
      });
      return created;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'users_org_email_uq')) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }

  return issueSession(user, newFamilyId(), meta);
};

export const login = async (input: LoginInput, meta: RequestMeta): Promise<IssuedSession> => {
  const orgId = await getCurrentOrgId();
  const user = await repo.findUserByEmail(pool, orgId, input.email);

  const hashToCompare = user && !user.archived_at ? user.password_hash : DUMMY_HASH;
  const ok = await bcrypt.compare(input.password, hashToCompare);

  if (!user || user.archived_at || !ok) {
    throw new UnauthorizedError('Invalid email or password');
  }
  return issueSession(user, newFamilyId(), meta);
};

export const refresh = async (presentedToken: string, meta: RequestMeta): Promise<IssuedSession> => {
  const hash = hashToken(presentedToken);
  const newToken = newOpaqueToken();
  const newExpiresAt = new Date(Date.now() + config.auth.refreshTokenTtlMs);

  const user = await withTransaction(async tx => {
    const session = await repo.findSessionByHashForUpdate(tx, hash);
    if (!session) throw new UnauthorizedError('Session not found');

    if (session.replaced_by_id) {
      const replacedAgoMs = Date.now() - (session.revoked_at?.getTime() ?? 0);
      if (replacedAgoMs <= ROTATION_GRACE_MS) {
        // concurrent refresh from another tab, not an attack
        throw new UnauthorizedError('Refresh already in progress');
      }
      // token reuse after rotation: assume the cookie was stolen, kill the family
      await repo.revokeFamily(tx, session.family_id);
      throw new UnauthorizedError('Session revoked');
    }
    if (session.revoked_at || session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedError('Session expired');
    }

    const u = await repo.findUserById(tx, (await getCurrentOrgId()), session.user_id);
    if (!u || u.archived_at) {
      await repo.revokeFamily(tx, session.family_id);
      throw new UnauthorizedError('Account unavailable');
    }

    const next = await repo.insertSession(tx, {
      userId: u.id, familyId: session.family_id, refreshTokenHash: hashToken(newToken),
      expiresAt: newExpiresAt, ip: meta.ip, userAgent: meta.userAgent,
    });
    await repo.markSessionReplaced(tx, session.id, next.id);
    return { user: u, familyId: session.family_id };
  });

  const accessToken = signAccessToken({ sub: user.user.id, org: user.user.org_id, role: user.user.role, fam: user.familyId });
  return { accessToken, refreshToken: newToken, refreshExpiresAt: newExpiresAt, user: toPublicUser(user.user) };
};

// logout of this browser: revoke the family the cookie belongs to
export const logout = async (presentedToken: string | undefined): Promise<void> => {
  if (!presentedToken) return;
  await withTransaction(async tx => {
    const session = await repo.findSessionByHashForUpdate(tx, hashToken(presentedToken));
    if (session) await repo.revokeFamily(tx, session.family_id);
  });
};

// logout everywhere: revoke every family for the user
export const logoutAll = async (orgId: string, userId: string, meta: RequestMeta): Promise<void> => {
  await withTransaction(async tx => {
    await repo.revokeAllForUser(tx, userId);
    await writeAudit(tx, {
      orgId, actorUserId: userId, action: 'user.logout_all', entityType: 'user', entityId: userId, ip: meta.ip,
    });
  });
};

export const me = async (orgId: string, userId: string): Promise<PublicUser> => {
  const user = await repo.findUserById(pool, orgId, userId);
  if (!user || user.archived_at) throw new UnauthorizedError('Account unavailable');
  return toPublicUser(user);
};

// always succeeds from the caller's point of view, so the response does not reveal
// whether the email is registered
export const requestPasswordReset = async (email: string, meta: RequestMeta): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const user = await repo.findUserByEmail(pool, orgId, email);
  if (!user || user.archived_at) return;

  const token = newOpaqueToken();
  await withTransaction(async tx => {
    await repo.insertResetToken(tx, user.id, hashToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));
    await enqueue(tx, {
      orgId, recipientUserId: user.id, eventKey: 'password_reset', template: 'password_reset_v1',
      // the dispatcher builds the link and clears payload after sending
      payload: { firstName: user.first_name, resetToken: token },
    });
    await writeAudit(tx, {
      orgId, actorUserId: null, action: 'user.password_reset_requested', entityType: 'user', entityId: user.id, ip: meta.ip,
    });
  });
};

export const confirmPasswordReset = async (token: string, newPassword: string, meta: RequestMeta): Promise<void> => {
  const orgId = await getCurrentOrgId();
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await withTransaction(async tx => {
    const row = await repo.findResetTokenForUpdate(tx, hashToken(token));
    if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedError('Reset link is invalid or has expired');
    }
    await repo.markResetTokenUsed(tx, row.id);
    await repo.updatePasswordHash(tx, row.user_id, passwordHash);
    // a password change invalidates every existing session
    await repo.revokeAllForUser(tx, row.user_id);
    await writeAudit(tx, {
      orgId, actorUserId: row.user_id, action: 'user.password_reset', entityType: 'user', entityId: row.user_id, ip: meta.ip,
    });
  });
};