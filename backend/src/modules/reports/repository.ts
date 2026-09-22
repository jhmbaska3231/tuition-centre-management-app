// backend/src/modules/reports/repository.ts
//
// read only aggregates for the admin dashboard. branch scoping is applied by passing
// branchids (null = all)

import { Queryable, many, one } from '../../db';

export const overview = (q: Queryable, orgId: string, branchIds: string[] | null) =>
  one(q,
    `SELECT
       (SELECT count(*)::int FROM students s WHERE s.org_id = $1 AND s.archived_at IS NULL AND ($2::uuid[] IS NULL OR s.home_branch_id = ANY($2))) AS active_students,
       (SELECT count(DISTINCT sg.user_id)::int FROM student_guardians sg JOIN students s ON s.id = sg.student_id WHERE s.org_id = $1 AND s.archived_at IS NULL AND ($2::uuid[] IS NULL OR s.home_branch_id = ANY($2))) AS active_parents,
       (SELECT count(*)::int FROM courses c WHERE c.org_id = $1 AND c.status = 'open' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))) AS open_courses,
       (SELECT count(*)::int FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.org_id = $1 AND e.status = 'active' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))) AS active_enrollments,
       (SELECT count(*)::int FROM waitlist_entries w JOIN courses c ON c.id = w.course_id WHERE w.org_id = $1 AND w.status IN ('waiting', 'offered') AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))) AS waitlisted,
       (SELECT count(*)::int FROM users u WHERE u.org_id = $1 AND u.role = 'tutor' AND u.archived_at IS NULL AND ($2::uuid[] IS NULL OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = u.id AND ub.branch_id = ANY($2)))) AS active_tutors,
       (SELECT count(*)::int FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.org_id = $1 AND s.status = 'scheduled' AND s.starts_at BETWEEN now() AND now() + interval '7 days' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))) AS sessions_next_7_days,
       -- fees are billed per family and an invoice can span branches, so a branch level figure would be misleading. branch managers receive null and the card is hidden
       CASE WHEN $2::uuid[] IS NULL THEN
         (SELECT COALESCE(sum(i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0)), 0)::bigint
          FROM invoices i WHERE i.org_id = $1 AND i.status IN ('issued', 'partially_paid'))
       END AS outstanding_cents,
       CASE WHEN $2::uuid[] IS NULL THEN
         (SELECT COALESCE(sum(i.total_cents - i.paid_cents - COALESCE((SELECT sum(amount_cents) FROM credit_notes WHERE invoice_id = i.id), 0)), 0)::bigint
          FROM invoices i WHERE i.org_id = $1 AND i.status IN ('issued', 'partially_paid') AND i.due_on < current_date)
       END AS overdue_cents,
       -- matches the scope of get /leave for a branch manager, so the card and the list agree
       (SELECT count(*)::int FROM leave_requests lr WHERE lr.org_id = $1 AND lr.status = 'pending' AND ($2::uuid[] IS NULL OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = lr.user_id AND ub.branch_id = ANY($2)))) AS pending_leave_requests`,
    [orgId, branchIds]);

// fill rate per open course
export const courseFill = (q: Queryable, orgId: string, branchIds: string[] | null) =>
  many(q,
    `SELECT c.id, c.name, b.name AS branch_name, sub.name AS subject_name, l.code AS level_code, c.capacity,
            (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS enrolled,
            (SELECT count(*)::int FROM waitlist_entries w WHERE w.course_id = c.id AND w.status IN ('waiting', 'offered')) AS waitlisted,
            round(100.0 * (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') / c.capacity, 1)::float AS fill_pct
     FROM courses c JOIN branches b ON b.id = c.branch_id JOIN subjects sub ON sub.id = c.subject_id LEFT JOIN levels l ON l.id = c.level_id
     WHERE c.org_id = $1 AND c.status = 'open' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))
     ORDER BY fill_pct DESC, c.name`, [orgId, branchIds]);

// active enrollments broken down by level and by subject
export const enrollmentBreakdown = (q: Queryable, orgId: string, branchIds: string[] | null) =>
  many(q,
    `SELECT 'level' AS dimension, COALESCE(l.code, 'Mixed') AS key, count(*)::int AS enrollments
     FROM enrollments e JOIN courses c ON c.id = e.course_id LEFT JOIN levels l ON l.id = c.level_id
     WHERE e.org_id = $1 AND e.status = 'active' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2)) GROUP BY l.code, l.sort_order
     UNION ALL
     SELECT 'subject', sub.name, count(*)::int
     FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN subjects sub ON sub.id = c.subject_id
     WHERE e.org_id = $1 AND e.status = 'active' AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2)) GROUP BY sub.name
     ORDER BY dimension, enrollments DESC`, [orgId, branchIds]);

// monthly invoiced vs collected, by invoice issue month and payment receipt month
export const revenueByMonth = (q: Queryable, orgId: string, from: string, to: string) =>
  many(q,
    `WITH months AS (SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), '1 month') d)
     SELECT m.month,
            COALESCE((SELECT sum(total_cents) FROM invoices i WHERE i.org_id = $1 AND i.status <> 'void' AND to_char(i.issued_at AT TIME ZONE o.timezone, 'YYYY-MM') = m.month), 0)::bigint AS invoiced_cents,
            COALESCE((SELECT sum(amount_cents) FROM payments p WHERE p.org_id = $1 AND p.status = 'succeeded' AND to_char(p.received_at AT TIME ZONE o.timezone, 'YYYY-MM') = m.month), 0)::bigint AS collected_cents,
            COALESCE((SELECT sum(amount_cents) FROM credit_notes cn WHERE cn.org_id = $1 AND to_char(cn.created_at AT TIME ZONE o.timezone, 'YYYY-MM') = m.month), 0)::bigint AS credited_cents
     FROM months m, organisations o WHERE o.id = $1 ORDER BY m.month`, [orgId, from, to]);

// attendance rate per course over a date range
export const attendanceByCourse = (q: Queryable, orgId: string, from: string, to: string, branchIds: string[] | null) =>
  many(q,
    `SELECT c.id, c.name, b.name AS branch_name,
            count(a.id)::int AS records,
            count(a.id) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended,
            count(a.id) FILTER (WHERE a.status = 'absent')::int AS absent,
            count(a.id) FILTER (WHERE a.status = 'excused')::int AS excused,
            CASE WHEN count(a.id) = 0 THEN NULL ELSE round(100.0 * count(a.id) FILTER (WHERE a.status IN ('present', 'late')) / count(a.id), 1)::float END AS attendance_pct
     FROM courses c JOIN branches b ON b.id = c.branch_id JOIN organisations o ON o.id = c.org_id
     LEFT JOIN sessions s ON s.course_id = c.id AND s.status = 'completed' AND (s.starts_at AT TIME ZONE o.timezone)::date BETWEEN $2 AND $3
     LEFT JOIN attendance a ON a.session_id = s.id
     WHERE c.org_id = $1 AND ($4::uuid[] IS NULL OR c.branch_id = ANY($4))
     GROUP BY c.id, c.name, b.name HAVING count(s.id) > 0 ORDER BY attendance_pct NULLS LAST, c.name`, [orgId, from, to, branchIds]);

// sessions taught per tutor per month (a workload view, not payroll)
export const tutorWorkload = (q: Queryable, orgId: string, from: string, to: string) =>
  many(q,
    `SELECT u.id AS tutor_id, u.first_name || ' ' || u.last_name AS tutor_name, to_char(s.starts_at AT TIME ZONE o.timezone, 'YYYY-MM') AS month,
            count(*)::int AS sessions, round(sum(extract(epoch FROM (s.ends_at - s.starts_at)) / 3600)::numeric, 1)::float AS hours,
            count(*) FILTER (WHERE s.cover_for_leave_id IS NOT NULL)::int AS cover_sessions
     FROM sessions s JOIN users u ON u.id = s.tutor_id JOIN organisations o ON o.id = s.org_id
     WHERE s.org_id = $1 AND s.status = 'completed' AND (s.starts_at AT TIME ZONE o.timezone)::date BETWEEN $2 AND $3
     GROUP BY u.id, u.first_name, u.last_name, month ORDER BY month DESC, tutor_name`, [orgId, from, to]);

// students whose last active enrollment ended in the window and who have no active enrollment now
export const churn = (q: Queryable, orgId: string, from: string, to: string) =>
  many(q,
    `SELECT s.id, s.first_name || ' ' || s.last_name AS student_name, max(COALESCE(e.ends_on, c.ends_on)) AS last_enrollment_ended
     FROM students s JOIN enrollments e ON e.student_id = s.id JOIN courses c ON c.id = e.course_id
     WHERE s.org_id = $1 AND s.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM enrollments a WHERE a.student_id = s.id AND a.status = 'active')
     GROUP BY s.id HAVING max(COALESCE(e.ends_on, c.ends_on)) BETWEEN $2 AND $3
     ORDER BY last_enrollment_ended DESC`, [orgId, from, to]);