// backend/src/modules/users/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';

export interface ParentView {
  id: string; email: string; first_name: string; last_name: string; phone: string | null; last_login_at: Date | null;
  archived_at: Date | null; created_at: Date;
  students: Array<{ id: string; first_name: string; last_name: string; level_code: string | null; relationship: string; is_billing_contact: boolean }>;
  outstanding_cents: number;
}

const PARENT_VIEW = `
  SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.last_login_at, u.archived_at, u.created_at,
         COALESCE((SELECT json_agg(json_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'level_code', l.code,
                                                     'relationship', sg.relationship, 'is_billing_contact', sg.is_billing_contact) ORDER BY s.first_name)
                   FROM student_guardians sg JOIN students s ON s.id = sg.student_id LEFT JOIN levels l ON l.id = s.level_id
                   WHERE sg.user_id = u.id AND s.archived_at IS NULL), '[]'::json) AS students,
         COALESCE((SELECT sum(i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0))
                   FROM invoices i WHERE i.bill_to_user_id = u.id AND i.status IN ('issued', 'partially_paid')), 0)::bigint AS outstanding_cents
  FROM users u`;

export const listParents = (q: Queryable, orgId: string, f: { q?: string; includeArchived: boolean; limit: number; offset: number }) =>
  many<ParentView>(q,
    `${PARENT_VIEW} WHERE u.org_id = $1 AND u.role = 'parent'
       AND ($2::text IS NULL OR u.email ILIKE '%' || $2 || '%' OR (u.first_name || ' ' || u.last_name) ILIKE '%' || $2 || '%')
       ${f.includeArchived ? '' : 'AND u.archived_at IS NULL'}
     ORDER BY u.first_name, u.last_name LIMIT $3 OFFSET $4`, [orgId, f.q ?? null, f.limit, f.offset]);

export const findParentView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<ParentView>(q, `${PARENT_VIEW} WHERE u.org_id = $1 AND u.id = $2 AND u.role = 'parent'`, [orgId, id]);

export const updateUserFields = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const keys = Object.keys(fields);
  return execute(q, `UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')} WHERE org_id = $1 AND id = $2`, [orgId, id, ...keys.map(k => fields[k])]);
};

export const findUserForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; role: string; password_hash: string; email: string; first_name: string; last_name: string; phone: string | null; archived_at: Date | null }>(q,
    'SELECT id, role, password_hash, email, first_name, last_name, phone, archived_at FROM users WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);

// rules for parent self deletion
export const deletionBlockers = (q: Queryable, userId: string) =>
  one<{ active_enrollments: number; open_invoices: number; sole_guardian_students: number }>(q,
    `SELECT
       (SELECT count(*)::int FROM enrollments e JOIN student_guardians sg ON sg.student_id = e.student_id
         WHERE sg.user_id = $1 AND e.status = 'active') AS active_enrollments,
       (SELECT count(*)::int FROM invoices WHERE bill_to_user_id = $1 AND status IN ('issued', 'partially_paid')) AS open_invoices,
       (SELECT count(*)::int FROM student_guardians sg JOIN students s ON s.id = sg.student_id
         WHERE sg.user_id = $1 AND s.archived_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM student_guardians o WHERE o.student_id = sg.student_id AND o.user_id <> $1)) AS sole_guardian_students`, [userId]);

// archive students where this user is the only guardian, leave shared students alone
export const archiveSoleGuardianStudents = (q: Queryable, userId: string) =>
  execute(q,
    `UPDATE students s SET archived_at = now()
     FROM student_guardians sg WHERE sg.student_id = s.id AND sg.user_id = $1 AND s.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM student_guardians o WHERE o.student_id = s.id AND o.user_id <> $1)`, [userId]);

export const withdrawFromWaitlists = (q: Queryable, userId: string) =>
  execute(q,
    `UPDATE waitlist_entries w SET status = 'withdrawn' FROM student_guardians sg
     WHERE sg.student_id = w.student_id AND sg.user_id = $1 AND w.status IN ('waiting', 'offered')`, [userId]);

export const archiveUser = (q: Queryable, id: string) =>
  execute(q, 'UPDATE users SET archived_at = now() WHERE id = $1', [id]);