// backend/src/modules/users/service.ts

import bcrypt from 'bcrypt';
import { isUniqueViolation, pool, withTransaction } from '../../db';
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError, UnauthorizedError } from '../../http/errors';
import { writeAudit } from '../audit/writer';
import { insertUser, revokeAllForUser } from '../auth/repository';
import { requestPasswordReset } from '../auth/service';
import { AuthUser } from '../auth/types';
import { newOpaqueToken } from '../auth/tokens';
import * as repo from './repository';

const BCRYPT_COST = 12;
const STAFF = new Set(['admin', 'branch_manager']);

// self service ---------------------------------------------------------------------

export const updateMyProfile = (user: AuthUser, input: { firstName?: string; lastName?: string; phone?: string | null }, ip: string | null) =>
  withTransaction(async tx => {
    const before = await repo.findUserForUpdate(tx, user.orgId, user.id);
    if (!before) throw new NotFoundError('User');
    const fields: Record<string, unknown> = {};
    if (input.firstName !== undefined) fields.first_name = input.firstName;
    if (input.lastName !== undefined) fields.last_name = input.lastName;
    if (input.phone !== undefined) fields.phone = input.phone;
    await repo.updateUserFields(tx, user.orgId, user.id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'user.profile_updated', entityType: 'user', entityId: user.id, before: { first_name: before.first_name, last_name: before.last_name, phone: before.phone }, after: fields, ip });
    return { id: user.id, email: before.email, role: before.role, first_name: input.firstName ?? before.first_name, last_name: input.lastName ?? before.last_name, phone: input.phone === undefined ? before.phone : input.phone };
  });

// changing the password ends every other session, the caller's own family survives
// because the route re issues a session afterwards
export const changeMyPassword = (user: AuthUser, currentPassword: string, newPassword: string, ip: string | null) =>
  withTransaction(async tx => {
    const row = await repo.findUserForUpdate(tx, user.orgId, user.id);
    if (!row) throw new NotFoundError('User');
    if (!(await bcrypt.compare(currentPassword, row.password_hash))) throw new UnauthorizedError('Current password is incorrect');
    await repo.updateUserFields(tx, user.orgId, user.id, { password_hash: await bcrypt.hash(newPassword, BCRYPT_COST) });
    await revokeAllForUser(tx, user.id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'user.password_changed', entityType: 'user', entityId: user.id, ip });
  });

// parent self deletion: archive, keep financial and attendance history. refused while
// anything is still live so nothing is silently abandoned
export const deleteMyAccount = (user: AuthUser, password: string, ip: string | null) =>
  withTransaction(async tx => {
    if (user.role !== 'parent') throw new ForbiddenError('Only parent accounts can be self-deleted');
    const row = await repo.findUserForUpdate(tx, user.orgId, user.id);
    if (!row) throw new NotFoundError('User');
    if (!(await bcrypt.compare(password, row.password_hash))) throw new UnauthorizedError('Password is incorrect');
    const b = await repo.deletionBlockers(tx, user.id);
    if (b.active_enrollments > 0) throw new RuleViolationError(`Withdraw from ${b.active_enrollments} active enrollment(s) first`, b);
    if (b.open_invoices > 0) throw new RuleViolationError(`Settle ${b.open_invoices} open invoice(s) first`, b);
    const studentsArchived = await repo.archiveSoleGuardianStudents(tx, user.id);
    await repo.withdrawFromWaitlists(tx, user.id);
    await repo.archiveUser(tx, user.id);
    await revokeAllForUser(tx, user.id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'user.self_deleted', entityType: 'user', entityId: user.id, after: { studentsArchived }, ip });
    return { studentsArchived };
  });

// parent management by staff ---------------------------------------------------------------------

export const listParents = (user: AuthUser, f: { q?: string; includeArchived: boolean; limit: number; offset: number }) => {
  if (user.role === 'parent') throw new ForbiddenError();
  return repo.listParents(pool, user.orgId, f);
};

export const getParent = async (user: AuthUser, id: string) => {
  if (user.role === 'parent') throw new ForbiddenError();
  const p = await repo.findParentView(pool, user.orgId, id);
  if (!p) throw new NotFoundError('Parent');
  return p;
};

export const createParent = async (user: AuthUser, input: { email: string; firstName: string; lastName: string; phone?: string }, ip: string | null) => {
  if (!STAFF.has(user.role)) throw new ForbiddenError();
  const created = await withTransaction(async tx => {
    try {
      const row = await insertUser(tx, { orgId: user.orgId, email: input.email, passwordHash: await bcrypt.hash(newOpaqueToken(), BCRYPT_COST), role: 'parent', firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null });
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'parent.created_by_staff', entityType: 'user', entityId: row.id, after: { email: row.email }, ip });
      return row;
    } catch (err) {
      if (isUniqueViolation(err, 'users_org_email_uq')) throw new ConflictError('An account with this email already exists');
      throw err;
    }
  });
  // the invite is the password reset flow: the parent sets their own password from the link
  await requestPasswordReset(created.email, { ip, userAgent: null });
  return (await repo.findParentView(pool, user.orgId, created.id))!;
};

export const updateParent = (user: AuthUser, id: string, input: { firstName?: string; lastName?: string; phone?: string | null }, ip: string | null) =>
  withTransaction(async tx => {
    if (!STAFF.has(user.role)) throw new ForbiddenError();
    const before = await repo.findUserForUpdate(tx, user.orgId, id);
    if (!before || before.role !== 'parent') throw new NotFoundError('Parent');
    const fields: Record<string, unknown> = {};
    if (input.firstName !== undefined) fields.first_name = input.firstName;
    if (input.lastName !== undefined) fields.last_name = input.lastName;
    if (input.phone !== undefined) fields.phone = input.phone;
    await repo.updateUserFields(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'parent.updated_by_staff', entityType: 'user', entityId: id, before: { first_name: before.first_name, last_name: before.last_name, phone: before.phone }, after: fields, ip });
    return (await repo.findParentView(tx, user.orgId, id))!;
  });