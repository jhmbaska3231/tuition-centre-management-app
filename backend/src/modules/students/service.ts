// backend/src/modules/students/service.ts

import { pool, withTransaction, Queryable } from '../../db';
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import * as repo from './repository';
import { StudentListFilters, StudentView } from './types';
import type { LevelChangeConflictDetails } from '@tuition/shared';

const STAFF_WRITE = new Set(['admin', 'branch_manager']);
const STAFF_READ = new Set(['admin', 'branch_manager', 'tutor']);

// loads the student and decides whether this caller may see it (read) or change it (write)
const loadForAccess = async (q: Queryable, user: AuthUser, studentId: string, mode: 'read' | 'write'): Promise<StudentView> => {
  const student = await repo.findStudentView(q, user.orgId, studentId);
  if (!student) throw new NotFoundError('Student');

  if (user.role === 'parent') {
    if (student.archived_at || !(await repo.isGuardian(q, studentId, user.id))) throw new NotFoundError('Student');
    return student;
  }
  if (mode === 'read' ? STAFF_READ.has(user.role) : STAFF_WRITE.has(user.role)) return student;
  throw new ForbiddenError();
};

const assertReferences = async (q: Queryable, orgId: string, levelId?: string | null, homeBranchId?: string | null) => {
  if (levelId) {
    const l = await repo.findLevel(q, orgId, levelId);
    if (!l || l.archived_at) throw new RuleViolationError('Selected level does not exist');
  }
  if (homeBranchId) {
    const b = await repo.findBranch(q, orgId, homeBranchId);
    if (!b || b.archived_at) throw new RuleViolationError('Selected branch does not exist');
  }
};

const assertLevelChangeAllowed = async (q: Queryable, studentId: string, newLevelId: string | null) => {
  const conflicts = await repo.listLevelConflictingEnrollments(q, studentId, newLevelId);
  if (conflicts.length > 0) {
    const details: LevelChangeConflictDetails = {
      courses: conflicts.map(c => ({ enrollmentId: c.enrollment_id, courseId: c.course_id, courseName: c.course_name })),
    };
    throw new RuleViolationError(
      'Withdraw from these level-specific courses before changing level: ' + conflicts.map(c => c.course_name).join(', '),
      details);
  }
};

// reads --------------------------------------------------------------------------

export const listStudents = (user: AuthUser, f: StudentListFilters) => {
  if (!STAFF_READ.has(user.role)) throw new ForbiddenError();
  return repo.listStudents(pool, user.orgId, f);
};

export const listMyStudents = (user: AuthUser) => repo.listStudentsForGuardian(pool, user.orgId, user.id);

export const getStudent = (user: AuthUser, id: string) => loadForAccess(pool, user, id, 'read');

// creates --------------------------------------------------------------------------

export const createOwnStudent = (user: AuthUser, input: {
  firstName: string; lastName: string; levelId: string; dateOfBirth: string | null; school: string | null;
  homeBranchId: string | null; notes: string | null; relationship: string;
}) =>
  withTransaction(async tx => {
    await assertReferences(tx, user.orgId, input.levelId, input.homeBranchId);
    const row = await repo.insertStudent(tx, user.orgId, input);
    await repo.insertGuardian(tx, { studentId: row.id, userId: user.id, relationship: input.relationship, isBillingContact: true, receivesNotifications: true });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.created', entityType: 'student', entityId: row.id, after: row });
    return (await repo.findStudentView(tx, user.orgId, row.id))!;
  });

export const createStudent = (user: AuthUser, input: {
  firstName: string; lastName: string; levelId: string | null; dateOfBirth: string | null; school: string | null;
  homeBranchId: string | null; notes: string | null; guardian: { userId: string; relationship: string };
}) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  return withTransaction(async tx => {
    await assertReferences(tx, user.orgId, input.levelId, input.homeBranchId);
    const parent = await repo.findParentById(tx, user.orgId, input.guardian.userId);
    if (!parent || parent.archived_at) throw new RuleViolationError('Guardian must be an active parent account');
    const row = await repo.insertStudent(tx, user.orgId, input);
    await repo.insertGuardian(tx, { studentId: row.id, userId: parent.id, relationship: input.guardian.relationship, isBillingContact: true, receivesNotifications: true });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.created', entityType: 'student', entityId: row.id, after: { ...row, guardianUserId: parent.id } });
    return (await repo.findStudentView(tx, user.orgId, row.id))!;
  });
};

// updates --------------------------------------------------------------------------

export const updateStudent = (user: AuthUser, id: string, input: {
  firstName?: string; lastName?: string; levelId?: string | null; dateOfBirth?: string | null;
  school?: string | null; homeBranchId?: string | null; notes?: string | null;
}) =>
  withTransaction(async tx => {
    const before = await loadForAccess(tx, user, id, 'write');
    if (before.archived_at) throw new NotFoundError('Student');
    await assertReferences(tx, user.orgId, input.levelId, input.homeBranchId);

    if (input.levelId !== undefined && input.levelId !== before.level_id) {
      await assertLevelChangeAllowed(tx, id, input.levelId);
    }

    const columns: Record<string, unknown> = {};
    if (input.firstName !== undefined) columns.first_name = input.firstName;
    if (input.lastName !== undefined) columns.last_name = input.lastName;
    if (input.levelId !== undefined) columns.level_id = input.levelId;
    if (input.dateOfBirth !== undefined) columns.date_of_birth = input.dateOfBirth;
    if (input.school !== undefined) columns.school = input.school;
    if (input.homeBranchId !== undefined) columns.home_branch_id = input.homeBranchId;
    if (input.notes !== undefined) columns.notes = input.notes;

    const after = await repo.updateStudent(tx, user.orgId, id, columns);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.updated', entityType: 'student', entityId: id, before, after });
    return (await repo.findStudentView(tx, user.orgId, id))!;
  });

export const archiveStudent = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await loadForAccess(tx, user, id, 'write');
    if (before.archived_at) throw new NotFoundError('Student');
    const active = await repo.countActiveEnrollments(tx, id);
    if (active > 0) throw new RuleViolationError(`Withdraw from ${active} active enrollment(s) first`);
    const unpaid = await repo.countUnpaidInvoiceLines(tx, id);
    if (unpaid > 0) throw new RuleViolationError('There are unpaid invoices for this student');
    await repo.setStudentArchived(tx, user.orgId, id, true);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.archived', entityType: 'student', entityId: id, before });
    return (await repo.findStudentView(tx, user.orgId, id))!;
  });

export const restoreStudent = (user: AuthUser, id: string) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  return withTransaction(async tx => {
    const before = await repo.findStudentView(tx, user.orgId, id);
    if (!before || !before.archived_at) throw new NotFoundError('Archived student');
    await repo.setStudentArchived(tx, user.orgId, id, false);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.restored', entityType: 'student', entityId: id, before });
    return (await repo.findStudentView(tx, user.orgId, id))!;
  });
};

// guardians --------------------------------------------------------------------------

export const addGuardian = (user: AuthUser, studentId: string, input: {
  email: string; relationship: string; isBillingContact: boolean; receivesNotifications: boolean;
}) =>
  withTransaction(async tx => {
    const student = await loadForAccess(tx, user, studentId, 'write');
    const parent = await repo.findParentByEmail(tx, user.orgId, input.email);
    // same message whether the email is unknown or not a parent
    if (!parent || parent.archived_at) throw new RuleViolationError('No active parent account was found for that email');
    if (student.guardians.some(g => g.user_id === parent.id)) throw new ConflictError('That person is already a guardian');

    if (input.isBillingContact) await repo.clearBillingContact(tx, studentId);
    await repo.insertGuardian(tx, { studentId, userId: parent.id, relationship: input.relationship, isBillingContact: input.isBillingContact, receivesNotifications: input.receivesNotifications });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.guardian_added', entityType: 'student', entityId: studentId, after: { userId: parent.id, relationship: input.relationship, isBillingContact: input.isBillingContact } });
    return (await repo.findStudentView(tx, user.orgId, studentId))!;
  });

export const updateGuardian = (user: AuthUser, studentId: string, guardianUserId: string, input: {
  relationship?: string; isBillingContact?: boolean; receivesNotifications?: boolean;
}) =>
  withTransaction(async tx => {
    const student = await loadForAccess(tx, user, studentId, 'write');
    const current = student.guardians.find(g => g.user_id === guardianUserId);
    if (!current) throw new NotFoundError('Guardian');

    // the billing contact can only be moved to someone else, never switched off outright
    if (input.isBillingContact === false && current.is_billing_contact) {
      throw new RuleViolationError('Set another guardian as billing contact instead');
    }
    if (input.isBillingContact === true && !current.is_billing_contact) {
      await repo.clearBillingContact(tx, studentId);
    }

    const columns: Record<string, unknown> = {};
    if (input.relationship !== undefined) columns.relationship = input.relationship;
    if (input.isBillingContact !== undefined) columns.is_billing_contact = input.isBillingContact;
    if (input.receivesNotifications !== undefined) columns.receives_notifications = input.receivesNotifications;

    await repo.updateGuardian(tx, studentId, guardianUserId, columns);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.guardian_updated', entityType: 'student', entityId: studentId, before: current, after: { userId: guardianUserId, ...input } });
    return (await repo.findStudentView(tx, user.orgId, studentId))!;
  });

export const removeGuardian = (user: AuthUser, studentId: string, guardianUserId: string) =>
  withTransaction(async tx => {
    const student = await loadForAccess(tx, user, studentId, 'write');
    const current = student.guardians.find(g => g.user_id === guardianUserId);
    if (!current) throw new NotFoundError('Guardian');
    if ((await repo.countGuardians(tx, studentId)) <= 1) throw new RuleViolationError('A student must keep at least one guardian');
    if (current.is_billing_contact) throw new RuleViolationError('Move the billing contact to another guardian first');

    await repo.deleteGuardian(tx, studentId, guardianUserId);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'student.guardian_removed', entityType: 'student', entityId: studentId, before: current });
    return (await repo.findStudentView(tx, user.orgId, studentId))!;
  });