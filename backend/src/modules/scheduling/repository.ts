// backend/src/modules/scheduling/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import { AvailabilityRow, CourseRow, CourseView, LeaveRow, LeaveView, SessionRow, SessionView, SlotRow, TermRow } from './types';

const set = (fields: Record<string, unknown>, startAt: number) => ({
  sql: Object.keys(fields).map((k, i) => `${k} = $${startAt + i}`).join(', '),
  params: Object.values(fields),
});

// terms ---------------------------------------------------------------------------

export const listTerms = (q: Queryable, orgId: string) =>
  many<TermRow>(q, 'SELECT * FROM terms WHERE org_id = $1 AND archived_at IS NULL ORDER BY starts_on DESC', [orgId]);
export const findTerm = (q: Queryable, orgId: string, id: string) =>
  maybeOne<TermRow>(q, 'SELECT * FROM terms WHERE org_id = $1 AND id = $2', [orgId, id]);
export const insertTerm = (q: Queryable, orgId: string, t: { name: string; starts_on: string; ends_on: string }) =>
  one<TermRow>(q, 'INSERT INTO terms (org_id, name, starts_on, ends_on) VALUES ($1, $2, $3, $4) RETURNING *', [orgId, t.name, t.starts_on, t.ends_on]);
export const updateTerm = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const s = set(fields, 3);
  return one<TermRow>(q, `UPDATE terms SET ${s.sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...s.params]);
};
export const archiveTerm = (q: Queryable, orgId: string, id: string) =>
  one<TermRow>(q, 'UPDATE terms SET archived_at = now() WHERE org_id = $1 AND id = $2 RETURNING *', [orgId, id]);

// courses ---------------------------------------------------------------------------

const COURSE_VIEW = `
  SELECT c.*, b.name AS branch_name, sub.name AS subject_name, l.code AS level_code, l.name AS level_name, t.name AS term_name,
         CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS tutor_name,
         cr.name AS classroom_name, fp.name AS fee_plan_name, fp.amount_cents AS fee_amount_cents, fp.billing_cycle AS fee_billing_cycle,
         COALESCE((SELECT json_agg(json_build_object('id', s.id, 'course_id', s.course_id, 'weekday', s.weekday, 'start_time', s.start_time, 'duration_minutes', s.duration_minutes) ORDER BY s.weekday, s.start_time)
                   FROM course_slots s WHERE s.course_id = c.id), '[]'::json) AS slots,
         (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS active_enrollment_count,
         (SELECT count(*)::int FROM waitlist_entries w WHERE w.course_id = c.id AND w.status IN ('waiting', 'offered')) AS waitlist_count
  FROM courses c
  JOIN branches b ON b.id = c.branch_id
  JOIN subjects sub ON sub.id = c.subject_id
  LEFT JOIN levels l ON l.id = c.level_id
  LEFT JOIN terms t ON t.id = c.term_id
  LEFT JOIN users u ON u.id = c.default_tutor_id
  LEFT JOIN classrooms cr ON cr.id = c.default_classroom_id
  LEFT JOIN fee_plans fp ON fp.id = c.fee_plan_id`;

export const findCourseView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<CourseView>(q, `${COURSE_VIEW} WHERE c.org_id = $1 AND c.id = $2`, [orgId, id]);
export const findCourse = (q: Queryable, orgId: string, id: string) =>
  maybeOne<CourseRow>(q, 'SELECT * FROM courses WHERE org_id = $1 AND id = $2', [orgId, id]);
export const findCourseForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<CourseRow>(q, 'SELECT * FROM courses WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);

export interface CourseFilters { branchId?: string; subjectId?: string; levelId?: string; tutorId?: string; status?: string }

export const listCourses = (q: Queryable, orgId: string, f: CourseFilters) =>
  many<CourseView>(q,
    `${COURSE_VIEW}
     WHERE c.org_id = $1
       AND ($2::uuid IS NULL OR c.branch_id = $2) AND ($3::uuid IS NULL OR c.subject_id = $3)
       AND ($4::uuid IS NULL OR c.level_id = $4) AND ($5::uuid IS NULL OR c.default_tutor_id = $5)
       AND ($6::text IS NULL OR c.status = $6)
     ORDER BY b.name, c.name`,
    [orgId, f.branchId ?? null, f.subjectId ?? null, f.levelId ?? null, f.tutorId ?? null, f.status ?? null]);

// open courses a parent's children could join: level matches a child's level or course is mixed
export const listCoursesForParent = (q: Queryable, orgId: string, parentId: string, studentId: string | null, f: CourseFilters) =>
  many<CourseView>(q,
    `${COURSE_VIEW}
     WHERE c.org_id = $1 AND c.status = 'open' AND (c.ends_on IS NULL OR c.ends_on >= current_date)
       AND (c.level_id IS NULL OR c.level_id IN (
             SELECT s.level_id FROM students s JOIN student_guardians g ON g.student_id = s.id
             WHERE g.user_id = $2 AND s.archived_at IS NULL AND ($3::uuid IS NULL OR s.id = $3)))
       AND ($4::uuid IS NULL OR c.branch_id = $4) AND ($5::uuid IS NULL OR c.subject_id = $5)
     ORDER BY b.name, c.name`,
    [orgId, parentId, studentId, f.branchId ?? null, f.subjectId ?? null]);

export const listCoursesForTutor = (q: Queryable, orgId: string, tutorId: string) =>
  many<CourseView>(q,
    `${COURSE_VIEW}
     WHERE c.org_id = $1 AND c.status IN ('open', 'closed')
       AND (c.default_tutor_id = $2 OR EXISTS (SELECT 1 FROM sessions s WHERE s.course_id = c.id AND s.tutor_id = $2 AND s.status = 'scheduled'))
     ORDER BY b.name, c.name`,
    [orgId, tutorId]);

export interface InsertCourseInput {
  branch_id: string; subject_id: string; level_id: string | null; term_id: string | null; fee_plan_id: string | null;
  name: string; description: string | null; default_tutor_id: string | null; default_classroom_id: string | null;
  capacity: number; starts_on: string; ends_on: string | null; created_by: string;
}

export const insertCourse = (q: Queryable, orgId: string, c: InsertCourseInput) =>
  one<CourseRow>(q,
    `INSERT INTO courses (org_id, branch_id, subject_id, level_id, term_id, fee_plan_id, name, description, default_tutor_id,
                          default_classroom_id, capacity, starts_on, ends_on, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [orgId, c.branch_id, c.subject_id, c.level_id, c.term_id, c.fee_plan_id, c.name, c.description, c.default_tutor_id,
      c.default_classroom_id, c.capacity, c.starts_on, c.ends_on, c.created_by]);

export const updateCourse = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const s = set(fields, 3);
  return one<CourseRow>(q, `UPDATE courses SET ${s.sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...s.params]);
};

export const listSlots = (q: Queryable, courseId: string) =>
  many<SlotRow>(q, 'SELECT * FROM course_slots WHERE course_id = $1 ORDER BY weekday, start_time', [courseId]);
export const insertSlot = (q: Queryable, courseId: string, s: { weekday: number; start_time: string; duration_minutes: number }) =>
  one<SlotRow>(q, 'INSERT INTO course_slots (course_id, weekday, start_time, duration_minutes) VALUES ($1, $2, $3, $4) RETURNING *',
    [courseId, s.weekday, s.start_time, s.duration_minutes]);
export const findSlot = (q: Queryable, courseId: string, slotId: string) =>
  maybeOne<SlotRow>(q, 'SELECT * FROM course_slots WHERE course_id = $1 AND id = $2', [courseId, slotId]);
export const deleteSlot = (q: Queryable, slotId: string) => execute(q, 'DELETE FROM course_slots WHERE id = $1', [slotId]);
export const countFutureSessionsForSlot = async (q: Queryable, slotId: string) =>
  (await one<{ n: number }>(q, `SELECT count(*)::int AS n FROM sessions WHERE slot_id = $1 AND status = 'scheduled' AND starts_at > now()`, [slotId])).n;

// reference checks used by the service
export const findActiveTutor = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; first_name: string; last_name: string }>(q,
    `SELECT id, first_name, last_name FROM users WHERE org_id = $1 AND id = $2 AND role = 'tutor' AND archived_at IS NULL`, [orgId, id]);
export const findClassroom = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; branch_id: string; capacity: number; archived_at: Date | null }>(q,
    'SELECT id, branch_id, capacity, archived_at FROM classrooms WHERE org_id = $1 AND id = $2', [orgId, id]);
export const exists = async (q: Queryable, table: string, orgId: string, id: string): Promise<boolean> =>
  (await maybeOne(q, `SELECT 1 FROM ${table} WHERE org_id = $1 AND id = $2 AND archived_at IS NULL`, [orgId, id])) !== null;
export const orgTimezone = async (q: Queryable, orgId: string) =>
  (await one<{ timezone: string }>(q, 'SELECT timezone FROM organisations WHERE id = $1', [orgId])).timezone;
export const orgSettings = (q: Queryable, orgId: string) =>
  one<{ session_horizon_weeks: number; adhoc_min_lead_minutes: number; adhoc_max_lead_days: number; travel_buffer_minutes: number }>(q,
    'SELECT session_horizon_weeks, adhoc_min_lead_minutes, adhoc_max_lead_days, travel_buffer_minutes FROM organisation_settings WHERE org_id = $1', [orgId]);

// closure dates applying to a branch within a range, as a set of 'yyyy-mm-dd'
export const closureDates = async (q: Queryable, orgId: string, branchId: string, from: string, to: string): Promise<Set<string>> => {
  const rows = await many<{ d: string }>(q,
    `SELECT DISTINCT d::date::text AS d
     FROM closures c, generate_series(greatest(c.starts_on, $3::date), least(c.ends_on, $4::date), '1 day') AS d
     WHERE c.org_id = $1 AND (c.branch_id IS NULL OR c.branch_id = $2) AND c.ends_on >= $3 AND c.starts_on <= $4`,
    [orgId, branchId, from, to]);
  return new Set(rows.map(r => r.d));
};

// sessions ---------------------------------------------------------------------------

const SESSION_VIEW = `
  SELECT s.*, c.name AS course_name, c.branch_id, b.name AS branch_name, l.code AS level_code, sub.name AS subject_name,
         CASE WHEN u.id IS NULL THEN NULL ELSE u.first_name || ' ' || u.last_name END AS tutor_name,
         cr.name AS classroom_name,
         (SELECT count(*)::int FROM enrollments e
            WHERE e.course_id = s.course_id AND e.status = 'active'
              AND e.starts_on <= (s.starts_at AT TIME ZONE o.timezone)::date
              AND (e.ends_on IS NULL OR e.ends_on >= (s.starts_at AT TIME ZONE o.timezone)::date))
         + (SELECT count(*)::int FROM makeup_bookings mb WHERE mb.booked_session_id = s.id AND mb.status = 'booked') AS roster_count,
         (s.status = 'scheduled' AND s.starts_at > now() AND (
            s.tutor_id IS NULL
            OR u.archived_at IS NOT NULL
            OR EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.user_id = s.tutor_id AND lr.status = 'approved'
                         AND (s.starts_at AT TIME ZONE o.timezone)::date BETWEEN lr.starts_on AND lr.ends_on))) AS needs_cover
  FROM sessions s
  JOIN organisations o ON o.id = s.org_id
  JOIN courses c ON c.id = s.course_id
  JOIN branches b ON b.id = c.branch_id
  JOIN subjects sub ON sub.id = c.subject_id
  LEFT JOIN levels l ON l.id = c.level_id
  LEFT JOIN users u ON u.id = s.tutor_id
  LEFT JOIN classrooms cr ON cr.id = s.classroom_id`;

export const findSessionView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<SessionView>(q, `${SESSION_VIEW} WHERE s.org_id = $1 AND s.id = $2`, [orgId, id]);
export const findSessionForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<SessionRow>(q, 'SELECT * FROM sessions WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);

export interface SessionFilters { from: Date; to: Date; courseId?: string; branchId?: string; tutorId?: string; classroomId?: string; status?: string; parentId?: string }

// the parent filter and the child labels are the same rule: a session is visible to a parent
// exactly when one of their children attends it, by active enrollment in the course or by a
// make up booked into this specific session. deriving it once in a lateral keeps the filter
// and the label from drifting, and guarantees every row a parent sees can be labelled.
// the lateral sits outside the view rather than inside it so only the parent path pays for it
export const listSessions = (q: Queryable, orgId: string, f: SessionFilters) =>
  many<SessionView>(q,
    `SELECT v.*, COALESCE(vs.ids, '{}') AS viewer_student_ids
     FROM (${SESSION_VIEW}
           WHERE s.org_id = $1 AND s.starts_at >= $2 AND s.starts_at < $3
             AND ($4::uuid IS NULL OR s.course_id = $4) AND ($5::uuid IS NULL OR c.branch_id = $5)
             AND ($6::uuid IS NULL OR s.tutor_id = $6) AND ($7::uuid IS NULL OR s.classroom_id = $7)
             AND ($8::text IS NULL OR s.status = $8)) v
     LEFT JOIN LATERAL (
       SELECT array_agg(DISTINCT sg.student_id) AS ids
       FROM student_guardians sg
       WHERE sg.user_id = $9
         AND (EXISTS (SELECT 1 FROM enrollments e
                       WHERE e.course_id = v.course_id AND e.student_id = sg.student_id AND e.status = 'active')
           OR EXISTS (SELECT 1 FROM makeup_bookings mb
                       WHERE mb.booked_session_id = v.id AND mb.student_id = sg.student_id AND mb.status = 'booked'))
     ) vs ON true
     WHERE ($9::uuid IS NULL OR vs.ids IS NOT NULL)
     ORDER BY v.starts_at`,
    [orgId, f.from, f.to, f.courseId ?? null, f.branchId ?? null, f.tutorId ?? null, f.classroomId ?? null, f.status ?? null, f.parentId ?? null]);

export const listSessionsNeedingCover = (q: Queryable, orgId: string, branchIds: string[] | null) =>
  many<SessionView>(q,
    `SELECT * FROM (${SESSION_VIEW} WHERE s.org_id = $1 AND s.status = 'scheduled' AND s.starts_at > now()
                    AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2))) v
     WHERE v.needs_cover ORDER BY v.starts_at`,
    [orgId, branchIds]);

export interface InsertSessionInput {
  course_id: string; slot_id: string | null; starts_at: Date; ends_at: Date; tutor_id: string | null; classroom_id: string | null;
  is_adhoc: boolean; created_by: string | null;
}

export const insertSession = (q: Queryable, orgId: string, s: InsertSessionInput) =>
  maybeOne<SessionRow>(q,
    `INSERT INTO sessions (org_id, course_id, slot_id, starts_at, ends_at, tutor_id, classroom_id, is_adhoc, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (course_id, starts_at) DO NOTHING RETURNING *`,
    [orgId, s.course_id, s.slot_id, s.starts_at, s.ends_at, s.tutor_id, s.classroom_id, s.is_adhoc, s.created_by]);

export const updateSession = (q: Queryable, orgId: string, id: string, fields: Record<string, unknown>) => {
  const s = set(fields, 3);
  return one<SessionRow>(q, `UPDATE sessions SET ${s.sql} WHERE org_id = $1 AND id = $2 RETURNING *`, [orgId, id, ...s.params]);
};

export const latestSessionDate = async (q: Queryable, courseId: string, slotId: string, zone: string): Promise<string | null> =>
  (await one<{ d: string | null }>(q,
    `SELECT (max(starts_at) AT TIME ZONE $3)::date::text AS d FROM sessions WHERE course_id = $1 AND slot_id = $2`, [courseId, slotId, zone])).d;

export const completePastSessions = (q: Queryable) =>
  execute(q, `UPDATE sessions SET status = 'completed' WHERE status = 'scheduled' AND ends_at < now()`);

export const cancelSessionsInClosure = (q: Queryable, orgId: string, branchId: string | null, from: string, to: string, reason: string) =>
  many<{ id: string }>(q,
    `UPDATE sessions s SET status = 'cancelled', cancel_reason = $5
     FROM courses c, organisations o
     WHERE s.course_id = c.id AND o.id = s.org_id AND s.org_id = $1 AND s.status = 'scheduled'
       AND ($2::uuid IS NULL OR c.branch_id = $2)
       AND (s.starts_at AT TIME ZONE o.timezone)::date BETWEEN $3 AND $4
     RETURNING s.id`,
    [orgId, branchId, from, to, reason]);

// soft rule checks: availability and travel buffer (warnings, not blocks)
export const tutorAvailableAt = async (q: Queryable, tutorId: string, weekday: number, startTime: string, endTime: string): Promise<boolean | null> => {
  const rows = await many<{ ok: boolean }>(q,
    `SELECT EXISTS (SELECT 1 FROM tutor_availability WHERE user_id = $1 AND weekday = $2 AND start_time <= $3 AND end_time >= $4) AS ok,
            EXISTS (SELECT 1 FROM tutor_availability WHERE user_id = $1) AS has_any`, [tutorId, weekday, startTime, endTime]);
  const r = rows[0] as any;
  return r.has_any ? r.ok : null;  // null = no availability set, nothing to warn about
};

export const adjacentSessionsAtOtherBranch = (q: Queryable, tutorId: string, branchId: string, startsAt: Date, endsAt: Date, bufferMinutes: number, excludeSessionId: string | null) =>
  many<{ id: string; course_name: string; branch_name: string; starts_at: Date; ends_at: Date }>(q,
    `SELECT s.id, c.name AS course_name, b.name AS branch_name, s.starts_at, s.ends_at
     FROM sessions s JOIN courses c ON c.id = s.course_id JOIN branches b ON b.id = c.branch_id
     WHERE s.tutor_id = $1 AND s.status = 'scheduled' AND c.branch_id <> $2 AND ($6::uuid IS NULL OR s.id <> $6)
       AND s.ends_at > $3::timestamptz - make_interval(mins => $5) AND s.starts_at < $4::timestamptz + make_interval(mins => $5)`,
    [tutorId, branchId, startsAt, endsAt, bufferMinutes, excludeSessionId]);

// a parent may read a single session only when one of their children is on its
// roster (active enrollment in the course) or has a make up booked into it. mirrors the
// parentid arm of listsessions so the list and the detail read agree on visibility
export const parentCanSeeSession = async (q: Queryable, orgId: string, sessionId: string, parentId: string): Promise<boolean> =>
  (await maybeOne(q,
    `SELECT 1
       FROM sessions s
       JOIN student_guardians g ON g.user_id = $3
      WHERE s.org_id = $1 AND s.id = $2
        AND (
          EXISTS (SELECT 1 FROM enrollments e
                    WHERE e.course_id = s.course_id AND e.status = 'active' AND e.student_id = g.student_id)
          OR EXISTS (SELECT 1 FROM makeup_bookings mb
                       WHERE mb.booked_session_id = s.id AND mb.student_id = g.student_id)
        )
      LIMIT 1`,
    [orgId, sessionId, parentId])) !== null;

// availability ---------------------------------------------------------------------------

export const listAvailability = (q: Queryable, userId: string) =>
  many<AvailabilityRow>(q, 'SELECT id, user_id, weekday, start_time, end_time FROM tutor_availability WHERE user_id = $1 ORDER BY weekday, start_time', [userId]);
export const replaceAvailability = async (q: Queryable, orgId: string, userId: string, slots: Array<{ weekday: number; start_time: string; end_time: string }>) => {
  await execute(q, 'DELETE FROM tutor_availability WHERE user_id = $1', [userId]);
  for (const s of slots) {
    await execute(q, 'INSERT INTO tutor_availability (org_id, user_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4, $5)', [orgId, userId, s.weekday, s.start_time, s.end_time]);
  }
};

// leave ---------------------------------------------------------------------------

const LEAVE_VIEW = `
  SELECT lr.*, u.first_name || ' ' || u.last_name AS requester_name, u.role AS requester_role,
         CASE WHEN d.id IS NULL THEN NULL ELSE d.first_name || ' ' || d.last_name END AS decided_by_name,
         (SELECT count(*)::int FROM sessions s JOIN organisations o ON o.id = s.org_id
           WHERE s.tutor_id = lr.user_id AND s.status = 'scheduled'
             AND (s.starts_at AT TIME ZONE o.timezone)::date BETWEEN lr.starts_on AND lr.ends_on) AS affected_session_count
  FROM leave_requests lr JOIN users u ON u.id = lr.user_id LEFT JOIN users d ON d.id = lr.decided_by`;

export const findLeaveView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<LeaveView>(q, `${LEAVE_VIEW} WHERE lr.org_id = $1 AND lr.id = $2`, [orgId, id]);
export const findLeaveForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<LeaveRow>(q, 'SELECT * FROM leave_requests WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);
export const listLeave = (q: Queryable, orgId: string, f: { status?: string; userId?: string; branchIds?: string[] | null }) =>
  many<LeaveView>(q,
    `${LEAVE_VIEW}
     WHERE lr.org_id = $1 AND ($2::text IS NULL OR lr.status = $2) AND ($3::uuid IS NULL OR lr.user_id = $3)
       AND ($4::uuid[] IS NULL OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id = lr.user_id AND ub.branch_id = ANY($4)))
     ORDER BY lr.status = 'pending' DESC, lr.starts_on DESC`,
    [orgId, f.status ?? null, f.userId ?? null, f.branchIds ?? null]);
export const insertLeave = (q: Queryable, orgId: string, l: { user_id: string; starts_on: string; ends_on: string; leave_type: string; reason: string | null; status: string; decided_by: string | null }) =>
  one<LeaveRow>(q,
    `INSERT INTO leave_requests (org_id, user_id, starts_on, ends_on, leave_type, reason, status, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $7 = 'approved' THEN now() END) RETURNING *`,
    [orgId, l.user_id, l.starts_on, l.ends_on, l.leave_type, l.reason, l.status, l.decided_by]);
export const decideLeave = (q: Queryable, id: string, status: string, decidedBy: string, note: string | null) =>
  one<LeaveRow>(q, `UPDATE leave_requests SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4 WHERE id = $1 RETURNING *`, [id, status, decidedBy, note]);
export const cancelLeave = (q: Queryable, id: string) =>
  one<LeaveRow>(q, `UPDATE leave_requests SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id]);
export const overlappingLeave = (q: Queryable, userId: string, from: string, to: string) =>
  maybeOne<{ id: string }>(q,
    `SELECT id FROM leave_requests WHERE user_id = $1 AND status IN ('pending', 'approved') AND ends_on >= $2 AND starts_on <= $3`, [userId, from, to]);
export const userBranchIds = async (q: Queryable, userId: string): Promise<string[]> =>
  (await many<{ branch_id: string }>(q, 'SELECT branch_id FROM user_branches WHERE user_id = $1', [userId])).map(r => r.branch_id);