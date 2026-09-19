// backend/src/modules/students/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import { StudentListFilters, StudentRow, StudentView } from './types';

// one select shape for every read, so the api returns the same student object everywhere
const VIEW = `
  SELECT s.*,
         l.code AS level_code, l.name AS level_name,
         b.name AS home_branch_name,
         (SELECT count(*)::int FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active') AS active_enrollment_count,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
                    'email', u.email, 'phone', u.phone, 'relationship', sg.relationship,
                    'is_billing_contact', sg.is_billing_contact, 'receives_notifications', sg.receives_notifications)
                  ORDER BY sg.is_billing_contact DESC, u.first_name)
           FROM student_guardians sg JOIN users u ON u.id = sg.user_id
           WHERE sg.student_id = s.id
         ), '[]'::json) AS guardians
  FROM students s
  LEFT JOIN levels l ON l.id = s.level_id
  LEFT JOIN branches b ON b.id = s.home_branch_id`;

export const findStudentView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<StudentView>(q, `${VIEW} WHERE s.org_id = $1 AND s.id = $2`, [orgId, id]);

export const findStudent = (q: Queryable, orgId: string, id: string) =>
  maybeOne<StudentRow>(q, 'SELECT * FROM students WHERE org_id = $1 AND id = $2', [orgId, id]);

export const listStudents = (q: Queryable, orgId: string, f: StudentListFilters) =>
  many<StudentView>(q,
    `${VIEW}
     WHERE s.org_id = $1
       AND ($2::text IS NULL OR (s.first_name || ' ' || s.last_name) ILIKE '%' || $2 || '%')
       AND ($3::uuid IS NULL OR s.level_id = $3)
       AND ($4::uuid IS NULL OR s.home_branch_id = $4)
       ${f.includeArchived ? '' : 'AND s.archived_at IS NULL'}
     ORDER BY s.first_name, s.last_name
     LIMIT $5 OFFSET $6`,
    [orgId, f.q ?? null, f.levelId ?? null, f.branchId ?? null, f.limit, f.offset]);

export const listStudentsForGuardian = (q: Queryable, orgId: string, userId: string) =>
  many<StudentView>(q,
    `${VIEW}
     WHERE s.org_id = $1 AND s.archived_at IS NULL
       AND EXISTS (SELECT 1 FROM student_guardians g WHERE g.student_id = s.id AND g.user_id = $2)
     ORDER BY s.first_name, s.last_name`,
    [orgId, userId]);

export const isGuardian = async (q: Queryable, studentId: string, userId: string) =>
  (await maybeOne(q, 'SELECT 1 FROM student_guardians WHERE student_id = $1 AND user_id = $2', [studentId, userId])) !== null;

export interface InsertStudentInput {
  firstName: string; lastName: string; levelId: string | null; dateOfBirth: string | null;
  school: string | null; homeBranchId: string | null; notes: string | null;
}

export const insertStudent = (q: Queryable, orgId: string, s: InsertStudentInput) =>
  one<StudentRow>(q,
    `INSERT INTO students (org_id, first_name, last_name, level_id, date_of_birth, school, home_branch_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [orgId, s.firstName, s.lastName, s.levelId, s.dateOfBirth, s.school, s.homeBranchId, s.notes]);

export const updateStudent = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const keys = Object.keys(fields);
  const sql = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  return one<StudentRow>(q, `UPDATE students SET ${sql} WHERE org_id = $1 AND id = $2 RETURNING *`,
    [orgId, id, ...keys.map(k => fields[k])]);
};

export const setStudentArchived = (q: Queryable, orgId: string, id: string, archived: boolean) =>
  execute(q, `UPDATE students SET archived_at = ${archived ? 'now()' : 'NULL'} WHERE org_id = $1 AND id = $2`, [orgId, id]);

// guardians ---------------------------------------------------------------------

export const insertGuardian = (q: Queryable, g: {
  studentId: string; userId: string; relationship: string; isBillingContact: boolean; receivesNotifications: boolean;
}) =>
  execute(q,
    `INSERT INTO student_guardians (student_id, user_id, relationship, is_billing_contact, receives_notifications)
     VALUES ($1, $2, $3, $4, $5)`,
    [g.studentId, g.userId, g.relationship, g.isBillingContact, g.receivesNotifications]);

export const updateGuardian = (q: Queryable, studentId: string, userId: string, fields: Record<string, unknown>) => {
  const keys = Object.keys(fields);
  const sql = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  return execute(q, `UPDATE student_guardians SET ${sql} WHERE student_id = $1 AND user_id = $2`,
    [studentId, userId, ...keys.map(k => fields[k])]);
};

export const clearBillingContact = (q: Queryable, studentId: string) =>
  execute(q, 'UPDATE student_guardians SET is_billing_contact = FALSE WHERE student_id = $1 AND is_billing_contact', [studentId]);

export const deleteGuardian = (q: Queryable, studentId: string, userId: string) =>
  execute(q, 'DELETE FROM student_guardians WHERE student_id = $1 AND user_id = $2', [studentId, userId]);

export const countGuardians = async (q: Queryable, studentId: string) =>
  (await one<{ n: number }>(q, 'SELECT count(*)::int AS n FROM student_guardians WHERE student_id = $1', [studentId])).n;

export const findParentByEmail = (q: Queryable, orgId: string, email: string) =>
  maybeOne<{ id: string; archived_at: Date | null }>(q,
    `SELECT id, archived_at FROM users WHERE org_id = $1 AND lower(email) = lower($2) AND role = 'parent'`, [orgId, email]);

export const findParentById = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; archived_at: Date | null }>(q,
    `SELECT id, archived_at FROM users WHERE org_id = $1 AND id = $2 AND role = 'parent'`, [orgId, id]);

// rule checks ---------------------------------------------------------------------

export const findLevel = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; archived_at: Date | null }>(q, 'SELECT id, archived_at FROM levels WHERE org_id = $1 AND id = $2', [orgId, id]);

export const findBranch = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; archived_at: Date | null }>(q, 'SELECT id, archived_at FROM branches WHERE org_id = $1 AND id = $2', [orgId, id]);

// active enrollments in level specific courses whose level differs from the proposed one
export const listLevelConflictingEnrollments = (q: Queryable, studentId: string, newLevelId: string | null) =>
  many<{ course_name: string }>(q,
    `SELECT c.name AS course_name
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.status = 'active' AND c.level_id IS NOT NULL
       AND ($2::uuid IS NULL OR c.level_id <> $2)`,
    [studentId, newLevelId]);

export const countActiveEnrollments = async (q: Queryable, studentId: string) =>
  (await one<{ n: number }>(q, `SELECT count(*)::int AS n FROM enrollments WHERE student_id = $1 AND status = 'active'`, [studentId])).n;

export const countUnpaidInvoiceLines = async (q: Queryable, studentId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
     WHERE il.student_id = $1 AND i.status IN ('issued', 'partially_paid')`, [studentId])).n;