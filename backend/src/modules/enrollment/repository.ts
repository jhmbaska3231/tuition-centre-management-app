// backend/src/modules/enrollment/repository.ts

import { Queryable, execute, many, maybeOne, one } from '../../db';
import { AttendanceRow, EnrollmentRow, EnrollmentView, MakeupView, RosterEntry, WaitlistRow, WaitlistView } from './types';

// enrollments -------------------------------------------------------------------

const ENROLLMENT_VIEW = `
  SELECT e.*, st.first_name || ' ' || st.last_name AS student_name, c.name AS course_name, b.name AS branch_name,
         sub.name AS subject_name, l.code AS level_code, fp.billing_cycle AS fee_billing_cycle,
         c.status AS course_status, c.ends_on AS course_ends_on, t.ends_on AS term_ends_on,
         (SELECT count(*)::int FROM attendance a JOIN sessions s ON s.id = a.session_id
           WHERE a.enrollment_id = e.id AND s.status = 'completed') AS sessions_held,
         (SELECT count(*)::int FROM attendance a WHERE a.enrollment_id = e.id AND a.status IN ('present', 'late')) AS sessions_attended,
         (SELECT count(*)::int FROM attendance a WHERE a.enrollment_id = e.id AND a.status IN ('absent', 'excused')) AS sessions_absent
  FROM enrollments e
  JOIN students st ON st.id = e.student_id
  JOIN courses c ON c.id = e.course_id
  JOIN branches b ON b.id = c.branch_id
  JOIN subjects sub ON sub.id = c.subject_id
  LEFT JOIN levels l ON l.id = c.level_id
  LEFT JOIN fee_plans fp ON fp.id = c.fee_plan_id
  LEFT JOIN terms t ON t.id = c.term_id`;

export const findEnrollmentView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<EnrollmentView>(q, `${ENROLLMENT_VIEW} WHERE e.org_id = $1 AND e.id = $2`, [orgId, id]);
export const findEnrollmentForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<EnrollmentRow>(q, 'SELECT * FROM enrollments WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);

export const listEnrollments = (q: Queryable, orgId: string, f: { studentId?: string; courseId?: string; status?: string; guardianId?: string; tutorId?: string }) =>
  many<EnrollmentView>(q,
    `${ENROLLMENT_VIEW}
     WHERE e.org_id = $1 AND ($2::uuid IS NULL OR e.student_id = $2) AND ($3::uuid IS NULL OR e.course_id = $3)
       AND ($4::text IS NULL OR e.status = $4)
       AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM student_guardians g WHERE g.student_id = e.student_id AND g.user_id = $5))
       AND ($6::uuid IS NULL OR c.default_tutor_id = $6 OR EXISTS (SELECT 1 FROM sessions s WHERE s.course_id = c.id AND s.tutor_id = $6))
     ORDER BY e.status = 'active' DESC, c.name, st.first_name`,
    [orgId, f.studentId ?? null, f.courseId ?? null, f.status ?? null, f.guardianId ?? null, f.tutorId ?? null]);

export const insertEnrollment = (q: Queryable, orgId: string, e: { student_id: string; course_id: string; starts_on: string; enrolled_by: string }) =>
  one<EnrollmentRow>(q,
    `INSERT INTO enrollments (org_id, student_id, course_id, starts_on, enrolled_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orgId, e.student_id, e.course_id, e.starts_on, e.enrolled_by]);

export const withdrawEnrollment = (q: Queryable, id: string, endsOn: string, immediate: boolean, reason: string | null) =>
  one<EnrollmentRow>(q,
    `UPDATE enrollments SET ends_on = $2, withdrawn_at = now(), withdraw_reason = $4,
       status = CASE WHEN $3 THEN 'withdrawn' ELSE status END
     WHERE id = $1 RETURNING *`, [id, endsOn, immediate, reason]);

// seats held from a given date: every active enrolment that has not ended before it. this
// counts enrolments starting later, so a course open for registration before its start
// date cannot be overfilled, and a withdrawal holds its seat until it takes effect
export const seatsTaken = async (q: Queryable, courseId: string, from: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM enrollments
      WHERE course_id = $1 AND status = 'active' AND (ends_on IS NULL OR ends_on >= $2)`,
    [courseId, from])).n;

// families waiting or holding an offer. the queue has first claim on any free seat
export const openWaitlistCount = async (q: Queryable, courseId: string) =>
  (await one<{ n: number }>(q,
    `SELECT count(*)::int AS n FROM waitlist_entries WHERE course_id = $1 AND status IN ('waiting', 'offered')`,
    [courseId])).n;

// lock the course row so concurrent enrollments serialise on the capacity check
export const lockCourse = (q: Queryable, orgId: string, courseId: string) =>
  maybeOne<{ id: string; branch_id: string; level_id: string | null; capacity: number; status: string; starts_on: string; ends_on: string | null; name: string; subject_id: string; term_ends_on: string | null; billing_cycle: string | null }>(q,
    `SELECT c.id, c.branch_id, c.level_id, c.capacity, c.status, c.starts_on, c.ends_on, c.name, c.subject_id, t.ends_on AS term_ends_on, fp.billing_cycle
     FROM courses c LEFT JOIN terms t ON t.id = c.term_id LEFT JOIN fee_plans fp ON fp.id = c.fee_plan_id
     WHERE c.org_id = $1 AND c.id = $2 FOR UPDATE OF c`, [orgId, courseId]);

export const findStudent = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; level_id: string | null; archived_at: Date | null; first_name: string; last_name: string }>(q,
    'SELECT id, level_id, archived_at, first_name, last_name FROM students WHERE org_id = $1 AND id = $2', [orgId, id]);

export const isGuardian = async (q: Queryable, studentId: string, userId: string) =>
  (await maybeOne(q, 'SELECT 1 FROM student_guardians WHERE student_id = $1 AND user_id = $2', [studentId, userId])) !== null;

export const guardiansToNotify = (q: Queryable, studentId: string) =>
  many<{ user_id: string }>(q,
    `SELECT sg.user_id FROM student_guardians sg JOIN users u ON u.id = sg.user_id
     WHERE sg.student_id = $1 AND sg.receives_notifications AND u.archived_at IS NULL`, [studentId]);

export const orgContext = (q: Queryable, orgId: string) =>
  one<{
    timezone: string; waitlist_offer_hours: number; attendance_edit_window_days: number;
    makeup_eligible_statuses: string[]; makeup_expiry_policy: string; makeup_expiry_days: number;
    makeup_min_lead_minutes: number; makeup_cap_per_term: number | null;
  }>(q,
    `SELECT o.timezone, s.waitlist_offer_hours, s.attendance_edit_window_days, s.makeup_eligible_statuses,
            s.makeup_expiry_policy, s.makeup_expiry_days, s.makeup_min_lead_minutes, s.makeup_cap_per_term
     FROM organisations o JOIN organisation_settings s ON s.org_id = o.id WHERE o.id = $1`, [orgId]);

// lifecycle job queries
export const settleEndedEnrollments = (q: Queryable, today: string) =>
  execute(q,
    `UPDATE enrollments e SET status = CASE WHEN e.withdrawn_at IS NULL THEN 'completed' ELSE 'withdrawn' END
     FROM courses c WHERE c.id = e.course_id AND e.status = 'active'
       AND COALESCE(e.ends_on, c.ends_on) IS NOT NULL AND COALESCE(e.ends_on, c.ends_on) < $1`, [today]);

// waitlist -------------------------------------------------------------------

const WAITLIST_VIEW = `
  SELECT w.*, st.first_name || ' ' || st.last_name AS student_name, c.name AS course_name,
         (SELECT count(*)::int FROM waitlist_entries w2 WHERE w2.course_id = w.course_id AND w2.status IN ('waiting', 'offered') AND w2.created_at <= w.created_at) AS position
  FROM waitlist_entries w JOIN students st ON st.id = w.student_id JOIN courses c ON c.id = w.course_id`;

export const findWaitlistView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<WaitlistView>(q, `${WAITLIST_VIEW} WHERE w.org_id = $1 AND w.id = $2`, [orgId, id]);
export const findWaitlistForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<WaitlistRow>(q, 'SELECT * FROM waitlist_entries WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);
export const listWaitlist = (q: Queryable, orgId: string, f: { courseId?: string; studentId?: string; guardianId?: string }) =>
  many<WaitlistView>(q,
    `${WAITLIST_VIEW}
     WHERE w.org_id = $1 AND w.status IN ('waiting', 'offered')
       AND ($2::uuid IS NULL OR w.course_id = $2) AND ($3::uuid IS NULL OR w.student_id = $3)
       AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM student_guardians g WHERE g.student_id = w.student_id AND g.user_id = $4))
     ORDER BY c.name, w.created_at`, [orgId, f.courseId ?? null, f.studentId ?? null, f.guardianId ?? null]);
export const insertWaitlist = (q: Queryable, orgId: string, studentId: string, courseId: string) =>
  one<WaitlistRow>(q, 'INSERT INTO waitlist_entries (org_id, student_id, course_id) VALUES ($1, $2, $3) RETURNING *', [orgId, studentId, courseId]);
export const setWaitlistStatus = (q: Queryable, id: string, status: string) =>
  one<WaitlistRow>(q, 'UPDATE waitlist_entries SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
export const offerWaitlist = (q: Queryable, id: string, expiresAt: Date) =>
  one<WaitlistRow>(q, `UPDATE waitlist_entries SET status = 'offered', offered_at = now(), offer_expires_at = $2 WHERE id = $1 RETURNING *`, [id, expiresAt]);
export const headOfQueue = (q: Queryable, courseId: string) =>
  maybeOne<WaitlistRow>(q, `SELECT * FROM waitlist_entries WHERE course_id = $1 AND status = 'waiting' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [courseId]);
export const hasOpenOffer = async (q: Queryable, courseId: string) =>
  (await maybeOne(q, `SELECT 1 FROM waitlist_entries WHERE course_id = $1 AND status = 'offered'`, [courseId])) !== null;
export const expiredOffers = (q: Queryable) =>
  many<WaitlistRow>(q, `SELECT * FROM waitlist_entries WHERE status = 'offered' AND offer_expires_at < now() FOR UPDATE SKIP LOCKED`);

// roster and attendance -------------------------------------------------------------------

export const findSession = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; course_id: string; starts_at: Date; ends_at: Date; tutor_id: string | null; status: string; branch_id: string; course_name: string; capacity: number; subject_id: string; level_id: string | null }>(q,
    `SELECT s.id, s.course_id, s.starts_at, s.ends_at, s.tutor_id, s.status, c.branch_id, c.name AS course_name, c.capacity, c.subject_id, c.level_id
     FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.org_id = $1 AND s.id = $2`, [orgId, id]);

export const roster = (q: Queryable, sessionId: string) =>
  many<RosterEntry>(q,
    `WITH ctx AS (SELECT s.id, s.course_id, (s.starts_at AT TIME ZONE o.timezone)::date AS d FROM sessions s JOIN organisations o ON o.id = s.org_id WHERE s.id = $1),
     members AS (
       SELECT e.student_id, 'enrollment' AS source, e.id AS enrollment_id, NULL::uuid AS makeup_booking_id
       FROM enrollments e, ctx WHERE e.course_id = ctx.course_id AND e.status = 'active' AND e.starts_on <= ctx.d AND (e.ends_on IS NULL OR e.ends_on >= ctx.d)
       UNION ALL
       -- attachment is membership: booked_session_id is set on booking and cleared on unbook
       -- or release, so any row still pointing here was expected at this session whatever
       -- became of the credit afterwards (booked, used, or forfeited by a no show)
       SELECT mb.student_id, 'makeup', NULL, mb.id FROM makeup_bookings mb WHERE mb.booked_session_id = $1)
     SELECT m.student_id, st.first_name || ' ' || st.last_name AS student_name, l.code AS level_code, m.source, m.enrollment_id, m.makeup_booking_id,
            a.id AS attendance_id, a.status, a.notes, a.marked_at
     FROM members m JOIN students st ON st.id = m.student_id LEFT JOIN levels l ON l.id = st.level_id
     LEFT JOIN attendance a ON a.session_id = $1 AND a.student_id = m.student_id
     WHERE st.archived_at IS NULL ORDER BY st.first_name, st.last_name`, [sessionId]);

export const upsertAttendance = (q: Queryable, orgId: string, a: { session_id: string; student_id: string; enrollment_id: string | null; makeup_booking_id: string | null; status: string; notes: string | null; marked_by: string }) =>
  one<AttendanceRow & { previous_status: string | null }>(q,
    `INSERT INTO attendance (org_id, session_id, student_id, enrollment_id, makeup_booking_id, status, notes, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (session_id, student_id) DO UPDATE
       SET status = EXCLUDED.status, notes = EXCLUDED.notes, marked_by = EXCLUDED.marked_by, marked_at = now()
     RETURNING *, (SELECT status FROM attendance a2 WHERE a2.session_id = $2 AND a2.student_id = $3) AS previous_status`,
    [orgId, a.session_id, a.student_id, a.enrollment_id, a.makeup_booking_id, a.status, a.notes, a.marked_by]);

export const existingAttendanceStatus = (q: Queryable, sessionId: string, studentId: string) =>
  maybeOne<{ status: string }>(q, 'SELECT status FROM attendance WHERE session_id = $1 AND student_id = $2', [sessionId, studentId]);

export const attendanceHistory = (q: Queryable, enrollmentId: string) =>
  many<{ session_id: string; starts_at: Date; session_status: string; status: string | null; notes: string | null; lesson_notes: string | null; homework: string | null }>(q,
    `SELECT s.id AS session_id, s.starts_at, s.status AS session_status, a.status, a.notes, s.lesson_notes, s.homework
     FROM enrollments e JOIN sessions s ON s.course_id = e.course_id
     JOIN organisations o ON o.id = e.org_id
     LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
     WHERE e.id = $1 AND (s.starts_at AT TIME ZONE o.timezone)::date >= e.starts_on
       AND (e.ends_on IS NULL OR (s.starts_at AT TIME ZONE o.timezone)::date <= e.ends_on)
       AND s.status <> 'cancelled' AND s.starts_at <= now()
     ORDER BY s.starts_at DESC`, [enrollmentId]);

// make ups -------------------------------------------------------------------

const MAKEUP_VIEW = `
  SELECT mb.id, mb.student_id, st.first_name || ' ' || st.last_name AS student_name, mb.credited_from_session_id, mb.booked_session_id,
         mb.status, mb.expires_on, mc.name AS missed_course_name, ms.starts_at AS missed_at, bc.name AS booked_course_name, bs.starts_at AS booked_at_time
  FROM makeup_bookings mb
  JOIN students st ON st.id = mb.student_id
  JOIN sessions ms ON ms.id = mb.credited_from_session_id JOIN courses mc ON mc.id = ms.course_id
  LEFT JOIN sessions bs ON bs.id = mb.booked_session_id LEFT JOIN courses bc ON bc.id = bs.course_id`;

export const findMakeupView = (q: Queryable, orgId: string, id: string) =>
  maybeOne<MakeupView>(q, `${MAKEUP_VIEW} WHERE mb.org_id = $1 AND mb.id = $2`, [orgId, id]);
export const findMakeupForUpdate = (q: Queryable, orgId: string, id: string) =>
  maybeOne<{ id: string; student_id: string; credited_from_session_id: string; booked_session_id: string | null; status: string; expires_on: string }>(q,
    'SELECT id, student_id, credited_from_session_id, booked_session_id, status, expires_on FROM makeup_bookings WHERE org_id = $1 AND id = $2 FOR UPDATE', [orgId, id]);
export const listMakeups = (q: Queryable, orgId: string, f: { studentId?: string; status?: string; guardianId?: string }) =>
  many<MakeupView>(q,
    `${MAKEUP_VIEW}
     WHERE mb.org_id = $1 AND ($2::uuid IS NULL OR mb.student_id = $2) AND ($3::text IS NULL OR mb.status = $3)
       AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM student_guardians g WHERE g.student_id = mb.student_id AND g.user_id = $4))
     ORDER BY mb.status = 'available' DESC, mb.expires_on`, [orgId, f.studentId ?? null, f.status ?? null, f.guardianId ?? null]);
export const insertMakeup = (q: Queryable, orgId: string, m: { student_id: string; credited_from_session_id: string; expires_on: string; granted_by: string }) =>
  maybeOne<{ id: string }>(q,
    `INSERT INTO makeup_bookings (org_id, student_id, credited_from_session_id, expires_on, granted_by) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, credited_from_session_id) DO NOTHING RETURNING id`, [orgId, m.student_id, m.credited_from_session_id, m.expires_on, m.granted_by]);
export const setMakeupStatus = (q: Queryable, id: string, status: string, bookedSessionId: string | null | undefined) =>
  execute(q,
    `UPDATE makeup_bookings SET status = $2, booked_session_id = CASE WHEN $3::text = 'keep' THEN booked_session_id ELSE $4::uuid END,
       booked_at = CASE WHEN $2 = 'booked' THEN now() ELSE booked_at END WHERE id = $1`,
    [id, status, bookedSessionId === undefined ? 'keep' : 'set', bookedSessionId ?? null]);
export const forfeitAvailableCredit = (q: Queryable, studentId: string, sessionId: string) =>
  execute(q, `UPDATE makeup_bookings SET status = 'forfeited' WHERE student_id = $1 AND credited_from_session_id = $2 AND status = 'available'`, [studentId, sessionId]);
export const releaseBookingsForSession = (q: Queryable, sessionId: string, today: string) =>
  many<{ id: string; student_id: string }>(q,
    `UPDATE makeup_bookings SET status = CASE WHEN expires_on >= $2 THEN 'available' ELSE 'expired' END, booked_session_id = NULL
     WHERE booked_session_id = $1 AND status = 'booked' RETURNING id, student_id`, [sessionId, today]);
export const expireMakeups = (q: Queryable, today: string) =>
  execute(q, `UPDATE makeup_bookings SET status = 'expired' WHERE status = 'available' AND expires_on < $1`, [today]);

// a credit booked into a session that ended with no attendance marked is stranded: not
// usable, not released, not expired. burn it, the same way a no show at a make up burns it.
// wait until the attendance edit window has closed first, so a tutor marking a few days
// late still decides the outcome rather than the job deciding it for them
export const forfeitUnmarkedBookings = (q: Queryable, editWindowDays: number) =>
  many<{ id: string; student_id: string; booked_session_id: string }>(q,
    `UPDATE makeup_bookings mb SET status = 'forfeited'
      WHERE mb.status = 'booked'
        AND EXISTS (SELECT 1 FROM sessions s
                     WHERE s.id = mb.booked_session_id AND s.status = 'completed'
                       AND s.ends_at < now() - make_interval(days => $1::int))
        AND NOT EXISTS (SELECT 1 FROM attendance a
                         WHERE a.session_id = mb.booked_session_id AND a.student_id = mb.student_id)
      RETURNING mb.id, mb.student_id, mb.booked_session_id`);

// sessions a credit can be booked into: same subject and level (or mixed), scheduled, with
// a seat, starting at least the centre's notice period from now, and not one the student is
// already on the roster for. the roster test is per session date rather than per course, so
// a credit can be used on the student's own course outside their enrolment window. that is
// the only option at a centre running one class per level
export const makeupOptions = (q: Queryable, orgId: string, studentId: string, subjectId: string, levelId: string | null, expiresOn: string, minLeadMinutes: number) =>
  many<{ id: string; course_id: string; course_name: string; branch_name: string; starts_at: Date; ends_at: Date; seats_left: number }>(q,
    `SELECT s.id, s.course_id, c.name AS course_name, b.name AS branch_name, s.starts_at, s.ends_at,
            c.capacity - (
              (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active'
                 AND e.starts_on <= (s.starts_at AT TIME ZONE o.timezone)::date AND (e.ends_on IS NULL OR e.ends_on >= (s.starts_at AT TIME ZONE o.timezone)::date))
            + (SELECT count(*)::int FROM makeup_bookings mb WHERE mb.booked_session_id = s.id AND mb.status = 'booked')) AS seats_left
     FROM sessions s JOIN courses c ON c.id = s.course_id JOIN branches b ON b.id = c.branch_id JOIN organisations o ON o.id = s.org_id
     WHERE s.org_id = $1 AND s.status = 'scheduled' AND c.status = 'open'
       AND s.starts_at > now() + make_interval(mins => $6::int)
       AND c.subject_id = $3 AND (c.level_id IS NULL OR c.level_id = $4)
       AND (s.starts_at AT TIME ZONE o.timezone)::date <= $5
       AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $2 AND e.status = 'active'
                         AND e.starts_on <= (s.starts_at AT TIME ZONE o.timezone)::date
                         AND (e.ends_on IS NULL OR e.ends_on >= (s.starts_at AT TIME ZONE o.timezone)::date))
       AND NOT EXISTS (SELECT 1 FROM makeup_bookings mb WHERE mb.booked_session_id = s.id AND mb.student_id = $2 AND mb.status = 'booked')
     ORDER BY s.starts_at`,
    [orgId, studentId, subjectId, levelId, expiresOn, minLeadMinutes]);

// how many make ups this student has already committed to in the term the missed session
// belongs to. derives the term from the session so callers do not need to carry it.
// is not distinct from, groups courses with no term together rather than matching nothing
export const countMakeupsInSameTerm = async (q: Queryable, orgId: string, studentId: string, creditedFromSessionId: string): Promise<number> => {
  const r = await one<{ n: number }>(q,
    `WITH t AS (SELECT c.term_id FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.id = $3)
     SELECT count(*)::int AS n
       FROM makeup_bookings mb
       JOIN sessions s2 ON s2.id = mb.credited_from_session_id
       JOIN courses c2 ON c2.id = s2.course_id, t
      WHERE mb.org_id = $1 AND mb.student_id = $2 AND mb.status IN ('booked', 'used')
        AND c2.term_id IS NOT DISTINCT FROM t.term_id`,
    [orgId, studentId, creditedFromSessionId]);
  return r.n;
};