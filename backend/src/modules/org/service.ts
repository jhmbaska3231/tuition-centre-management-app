// backend/src/modules/org/service.ts

import bcrypt from 'bcrypt';
import { isUniqueViolation, pool, withTransaction } from '../../db';
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors';
import { decrypt, encrypt } from '../../lib/crypto';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { insertUser, revokeAllForUser } from '../auth/repository';
import * as repo from './repository';
import { IntegrationRow, StaffRow } from './types';
import { applyClosure } from '../scheduling/service';
import { invalidateEmailProvider } from '../notifications/providers/email';

const BCRYPT_COST = 12;

const assertBranchAccess = (user: AuthUser, branchId: string): void => {
  if (user.role === 'admin' || user.branchIds.includes(branchId)) return;
  throw new ForbiddenError('You do not manage that branch');
};

// organisation and settings --------------------------------------------------------------------

export const getOrganisation = async (orgId: string) => {
  const [org, settings] = await Promise.all([repo.findOrganisation(pool, orgId), repo.findSettings(pool, orgId)]);
  return { organisation: org, settings };
};

export const updateSettings = (user: AuthUser, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    const before = await repo.findSettings(tx, user.orgId);
    const after = await repo.updateSettings(tx, user.orgId, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'org.settings_updated', entityType: 'organisation_settings', entityId: user.orgId, before, after });
    return after;
  });

export const listEventSettings = (orgId: string) => repo.listEventSettings(pool, orgId);

export const toggleEvent = (user: AuthUser, eventKey: string, enabled: boolean) =>
  withTransaction(async tx => {
    const row = await repo.upsertEventSetting(tx, user.orgId, eventKey, enabled);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'org.notification_event_toggled', entityType: 'notification_event_setting', entityId: null, after: row });
    return row;
  });

// integrations. config is never returned decrypted over http
const maskIntegration = (row: IntegrationRow) => {
  const cfg = JSON.parse(decrypt(row.config_encrypted)) as Record<string, string>;
  const preview: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    preview[k] = v.length <= 4 ? '****' : `****${v.slice(-4)}`;
  }
  return { kind: row.kind, provider: row.provider, is_active: row.is_active, config_preview: preview, updated_at: row.updated_at };
};

export const listIntegrations = async (orgId: string) => (await repo.listIntegrations(pool, orgId)).map(maskIntegration);

export const upsertIntegration = (user: AuthUser, kind: string, input: { provider: string; config: Record<string, string>; is_active: boolean }) =>
  withTransaction(async tx => {
    const row = await repo.upsertIntegration(tx, {
      orgId: user.orgId, kind, provider: input.provider, configEncrypted: encrypt(JSON.stringify(input.config)),
      isActive: input.is_active, updatedBy: user.id,
    });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'org.integration_updated', entityType: 'org_integration', entityId: row.id, after: { kind, provider: input.provider, is_active: input.is_active } });
    invalidateEmailProvider(user.orgId);
    return maskIntegration(row);
  });

export const removeIntegration = (user: AuthUser, kind: string) =>
  withTransaction(async tx => {
    const n = await repo.deleteIntegration(tx, user.orgId, kind);
    if (n === 0) throw new NotFoundError('Integration');
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'org.integration_removed', entityType: 'org_integration', entityId: null, after: { kind } });
    invalidateEmailProvider(user.orgId);
  });

// branches --------------------------------------------------------------------

export const listBranches = (orgId: string, includeArchived: boolean) => repo.listBranches(pool, orgId, includeArchived);

export const createBranch = async (user: AuthUser, input: { name: string; address: string; phone?: string }) => {
  try {
    return await withTransaction(async tx => {
      const row = await repo.insertBranch(tx, user.orgId, { name: input.name, address: input.address, phone: input.phone ?? null });
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'branch.created', entityType: 'branch', entityId: row.id, after: row });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'branches_org_id_name_key')) throw new ConflictError('A branch with that name already exists');
    throw err;
  }
};

export const updateBranch = (user: AuthUser, id: string, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    const before = await repo.findBranch(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Branch');
    const after = await repo.updateBranch(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'branch.updated', entityType: 'branch', entityId: id, before, after });
    return after;
  });

export const archiveBranch = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findBranch(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Branch');
    const open = await repo.countOpenCoursesInBranch(tx, id);
    if (open > 0) throw new RuleViolationError(`Close or move ${open} open course(s) before archiving this branch`);
    const after = await repo.archiveBranch(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'branch.archived', entityType: 'branch', entityId: id, before });
    return after;
  });

// classrooms --------------------------------------------------------------------

export const listClassrooms = async (user: AuthUser, branchId: string, includeArchived: boolean) => {
  const branch = await repo.findBranch(pool, user.orgId, branchId);
  if (!branch) throw new NotFoundError('Branch');
  return repo.listClassrooms(pool, user.orgId, branchId, includeArchived);
};

export const createClassroom = async (user: AuthUser, branchId: string, input: { name: string; capacity: number }) => {
  assertBranchAccess(user, branchId);
  const branch = await repo.findBranch(pool, user.orgId, branchId);
  if (!branch || branch.archived_at) throw new NotFoundError('Branch');
  try {
    return await withTransaction(async tx => {
      const row = await repo.insertClassroom(tx, user.orgId, branchId, input);
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'classroom.created', entityType: 'classroom', entityId: row.id, after: row });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'classrooms_branch_id_name_key')) throw new ConflictError('A room with that name already exists in this branch');
    throw err;
  }
};

export const updateClassroom = (user: AuthUser, id: string, fields: { name?: string; capacity?: number }) =>
  withTransaction(async tx => {
    const before = await repo.findClassroom(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Classroom');
    assertBranchAccess(user, before.branch_id);
    if (fields.capacity !== undefined && fields.capacity < before.capacity) {
      const needed = await repo.maxOpenCourseCapacityForRoom(tx, id);
      if (fields.capacity < needed) {
        throw new RuleViolationError(`Capacity cannot be below ${needed}; an open course in this room needs it`);
      }
    }
    const after = await repo.updateClassroom(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'classroom.updated', entityType: 'classroom', entityId: id, before, after });
    return after;
  });

export const archiveClassroom = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findClassroom(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Classroom');
    assertBranchAccess(user, before.branch_id);
    const future = await repo.countFutureSessionsInRoom(tx, id);
    if (future > 0) throw new RuleViolationError(`Move ${future} upcoming session(s) out of this room before archiving it`);
    const after = await repo.archiveClassroom(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'classroom.archived', entityType: 'classroom', entityId: id, before });
    return after;
  });

// closures --------------------------------------------------------------------

export const listClosures = (orgId: string, from?: string, to?: string) => repo.listClosures(pool, orgId, from ?? null, to ?? null);

export const createClosure = async (user: AuthUser, input: { branch_id: string | null; starts_on: string; ends_on: string; reason: string }) => {
  if (input.branch_id) {
    assertBranchAccess(user, input.branch_id);
    const branch = await repo.findBranch(pool, user.orgId, input.branch_id);
    if (!branch || branch.archived_at) throw new NotFoundError('Branch');
  } else if (user.role !== 'admin') {
    throw new ForbiddenError('Only admins can close every branch');
  }
  return withTransaction(async tx => {
    const row = await repo.insertClosure(tx, user.orgId, input);
    const cancelled = await applyClosure(tx, user.orgId, user.id, row);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'closure.created', entityType: 'closure', entityId: row.id, after: row });
    // the scheduling module owns what happens to sessions already generated inside this
    // range (cancel and notify). it exposes applyclosure(tx, closure) and this call site
    // will invoke it once that module exists
    return { ...row, sessionsCancelled: cancelled };
  });
};

export const deleteClosure = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findClosure(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Closure');
    if (before.branch_id) assertBranchAccess(user, before.branch_id);
    else if (user.role !== 'admin') throw new ForbiddenError();
    await repo.deleteClosure(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'closure.deleted', entityType: 'closure', entityId: id, before });
  });

// levels and subjects --------------------------------------------------------------------

export const listLevels = (orgId: string, includeArchived: boolean) => repo.listLevels(pool, orgId, includeArchived);

export const createLevel = async (user: AuthUser, input: { code: string; name: string; sort_order: number }) => {
  try {
    return await withTransaction(async tx => {
      const row = await repo.insertLevel(tx, user.orgId, input);
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'level.created', entityType: 'level', entityId: row.id, after: row });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'levels_org_id_code_key')) throw new ConflictError('A level with that code already exists');
    throw err;
  }
};

export const updateLevel = (user: AuthUser, id: string, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    const before = await repo.findLevel(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Level');
    const after = await repo.updateLevel(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'level.updated', entityType: 'level', entityId: id, before, after });
    return after;
  });

export const archiveLevel = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findLevel(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Level');
    const open = await repo.countOpenCoursesForLevel(tx, id);
    if (open > 0) throw new RuleViolationError(`${open} open course(s) use this level`);
    const after = await repo.archiveLevel(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'level.archived', entityType: 'level', entityId: id, before });
    return after;
  });

export const listSubjects = (orgId: string, includeArchived: boolean) => repo.listSubjects(pool, orgId, includeArchived);

export const createSubject = async (user: AuthUser, name: string) => {
  try {
    return await withTransaction(async tx => {
      const row = await repo.insertSubject(tx, user.orgId, name);
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'subject.created', entityType: 'subject', entityId: row.id, after: row });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'subjects_org_id_name_key')) throw new ConflictError('A subject with that name already exists');
    throw err;
  }
};

export const updateSubject = (user: AuthUser, id: string, name: string) =>
  withTransaction(async tx => {
    const before = await repo.findSubject(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Subject');
    const after = await repo.updateSubject(tx, user.orgId, id, name);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'subject.updated', entityType: 'subject', entityId: id, before, after });
    return after;
  });

export const archiveSubject = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findSubject(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Subject');
    const open = await repo.countOpenCoursesForSubject(tx, id);
    if (open > 0) throw new RuleViolationError(`${open} open course(s) use this subject`);
    const after = await repo.archiveSubject(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'subject.archived', entityType: 'subject', entityId: id, before });
    return after;
  });

// staff --------------------------------------------------------------------

const assertBranchesExist = async (q: Parameters<typeof repo.findBranch>[0], orgId: string, branchIds: string[]) => {
  for (const id of branchIds) {
    const b = await repo.findBranch(q, orgId, id);
    if (!b || b.archived_at) throw new NotFoundError('Branch');
  }
};

export const listStaff = (user: AuthUser, role: string | undefined, includeArchived: boolean) =>
  repo.listStaff(pool, user.orgId, role ?? null, includeArchived);

export const getStaff = async (user: AuthUser, id: string): Promise<StaffRow> => {
  const row = await repo.findStaff(pool, user.orgId, id);
  if (!row) throw new NotFoundError('Staff member');
  return row;
};

export const createStaff = async (user: AuthUser, input: {
  email: string; password: string; role: 'tutor' | 'branch_manager' | 'admin';
  firstName: string; lastName: string; phone?: string; branchIds: string[];
}, ip: string | null): Promise<StaffRow> => {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  try {
    return await withTransaction(async tx => {
      await assertBranchesExist(tx, user.orgId, input.branchIds);
      const created = await insertUser(tx, {
        orgId: user.orgId, email: input.email, passwordHash, role: input.role,
        firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null,
      });
      await repo.replaceUserBranches(tx, created.id, input.branchIds);
      await writeAudit(tx, {
        orgId: user.orgId, actorUserId: user.id, action: 'staff.created', entityType: 'user', entityId: created.id,
        after: { email: created.email, role: created.role, branchIds: input.branchIds }, ip,
      });
      return (await repo.findStaff(tx, user.orgId, created.id))!;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'users_org_email_uq')) throw new ConflictError('An account with this email already exists');
    throw err;
  }
};

export const updateStaff = (user: AuthUser, id: string, fields: { firstName?: string; lastName?: string; phone?: string | null }) =>
  withTransaction(async tx => {
    const before = await repo.findStaff(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Staff member');
    const columns: Record<string, unknown> = {};
    if (fields.firstName !== undefined) columns.first_name = fields.firstName;
    if (fields.lastName !== undefined) columns.last_name = fields.lastName;
    if (fields.phone !== undefined) columns.phone = fields.phone;
    await repo.updateStaff(tx, user.orgId, id, columns);
    const after = (await repo.findStaff(tx, user.orgId, id))!;
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'staff.updated', entityType: 'user', entityId: id, before, after });
    return after;
  });

export const setStaffBranches = (user: AuthUser, id: string, branchIds: string[]) =>
  withTransaction(async tx => {
    const before = await repo.findStaff(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Staff member');
    await assertBranchesExist(tx, user.orgId, branchIds);
    await repo.replaceUserBranches(tx, id, branchIds);
    const after = (await repo.findStaff(tx, user.orgId, id))!;
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'staff.branches_set', entityType: 'user', entityId: id, before: { branchIds: before.branch_ids }, after: { branchIds } });
    return after;
  });

// archiving revokes every session immediately. future sessions the tutor was assigned
// to keep their tutor_id, the scheduling module surfaces them as needing cover
export const archiveStaff = (user: AuthUser, id: string, ip: string | null) =>
  withTransaction(async tx => {
    const before = await repo.findStaff(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Staff member');
    if (before.id === user.id) throw new RuleViolationError('You cannot archive your own account');
    if (before.role === 'admin' && (await repo.countActiveAdmins(tx, user.orgId)) <= 1) {
      throw new RuleViolationError('At least one active admin is required');
    }
    await repo.setStaffArchived(tx, user.orgId, id, true);
    await revokeAllForUser(tx, id);
    const futureSessions = await repo.countFutureSessionsForTutor(tx, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'staff.archived', entityType: 'user', entityId: id, before, after: { futureSessionsNeedingCover: futureSessions }, ip });
    return { ...(await repo.findStaff(tx, user.orgId, id))!, futureSessionsNeedingCover: futureSessions };
  });

export const restoreStaff = (user: AuthUser, id: string, ip: string | null) =>
  withTransaction(async tx => {
    const before = await repo.findStaff(tx, user.orgId, id);
    if (!before || !before.archived_at) throw new NotFoundError('Archived staff member');
    await repo.setStaffArchived(tx, user.orgId, id, false);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'staff.restored', entityType: 'user', entityId: id, before, ip });
    return (await repo.findStaff(tx, user.orgId, id))!;
  });