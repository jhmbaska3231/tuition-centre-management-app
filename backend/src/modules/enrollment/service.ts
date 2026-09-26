// backend/src/modules/enrollment/service.ts

import { PoolClient } from 'pg';
import { isUniqueViolation, pool, withTransaction, Queryable } from '../../db';
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors';
import { addDays, dateInZone, todayIn } from '../../lib/time';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { enqueue } from '../notifications/outbox';
import * as repo from './repository';

const STAFF_WRITE = new Set(['admin', 'branch_manager']);
const monthEnd = (d: string) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

// a parent may act for their own children, staff for anyone. returns the student
const assertStudentAccess = async (q: Queryable, user: AuthUser, studentId: string) => {
  const s = await repo.findStudent(q, user.orgId, studentId);
  if (!s || s.archived_at) throw new NotFoundError('Student');
  if (user.role === 'parent' && !(await repo.isGuardian(q, studentId, user.id))) throw new NotFoundError('Student');
  if (user.role === 'tutor') throw new ForbiddenError();
  return s;
};

const assertBranch = (user: AuthUser, branchId: string) => {
  if (user.role === 'admin' || user.role === 'parent' || user.branchIds.includes(branchId)) return;
  throw new ForbiddenError('You do not manage that branch');
};

const notifyGuardians = async (tx: Queryable, orgId: string, studentId: string, eventKey: string, template: string, payload: Record<string, unknown>, dedupe: string) => {
  for (const g of await repo.guardiansToNotify(tx, studentId)) {
    await enqueue(tx, { orgId, recipientUserId: g.user_id, eventKey, template, payload, dedupeKey: `${dedupe}:${g.user_id}` });
  }
};

// enrollments --------------------------------------------------------------------

// the date seats are measured from: nobody can start before the course does
const seatDate = (course: { starts_on: string }, today: string) => (course.starts_on > today ? course.starts_on : today);

// seats a new family can take: free seats not already claimed by the waitlist, which has
// priority. the course view's seats_left uses the same rule, so the page and this check agree
const seatsOpenToNewcomers = async (tx: PoolClient, course: { id: string; capacity: number; starts_on: string }, today: string) =>
  course.capacity
    - (await repo.seatsTaken(tx, course.id, seatDate(course, today)))
    - (await repo.openWaitlistCount(tx, course.id));

export const listEnrollments = (user: AuthUser, f: { studentId?: string; courseId?: string; status?: string }) => {
  if (user.role === 'parent') return repo.listEnrollments(pool, user.orgId, { ...f, guardianId: user.id });
  if (user.role === 'tutor') return repo.listEnrollments(pool, user.orgId, { ...f, tutorId: user.id });
  return repo.listEnrollments(pool, user.orgId, f);
};

export const getEnrollment = async (user: AuthUser, id: string) => {
  const e = await repo.findEnrollmentView(pool, user.orgId, id);
  if (!e) throw new NotFoundError('Enrollment');
  if (user.role === 'parent' && !(await repo.isGuardian(pool, e.student_id, user.id))) throw new NotFoundError('Enrollment');
  return e;
};

export const attendanceHistory = async (user: AuthUser, enrollmentId: string) => {
  await getEnrollment(user, enrollmentId);
  return repo.attendanceHistory(pool, enrollmentId);
};

// shared by enroll and waitlist accept, caller holds the course lock
const createEnrollmentLocked = async (tx: PoolClient, user: AuthUser, course: NonNullable<Awaited<ReturnType<typeof repo.lockCourse>>>, student: NonNullable<Awaited<ReturnType<typeof repo.findStudent>>>, startsOn: string) => {
  if (course.level_id && course.level_id !== student.level_id) throw new RuleViolationError('This course is for a different level');
  try {
    const row = await repo.insertEnrollment(tx, user.orgId, { student_id: student.id, course_id: course.id, starts_on: startsOn, enrolled_by: user.id });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'enrollment.created', entityType: 'enrollment', entityId: row.id, after: row });
    return row;
  } catch (err) {
    if (isUniqueViolation(err, 'enrollments_one_active_per_course_uq')) throw new ConflictError('Already enrolled in this course');
    throw err;
  }
};

export const enroll = (user: AuthUser, input: { studentId: string; courseId: string; startsOn?: string }) =>
  withTransaction(async tx => {
    const student = await assertStudentAccess(tx, user, input.studentId);
    const course = await repo.lockCourse(tx, user.orgId, input.courseId);
    if (!course || course.status !== 'open') throw new NotFoundError('Open course');
    assertBranch(user, course.branch_id);
    const { timezone } = await repo.orgContext(tx, user.orgId);
    const today = todayIn(timezone);
    const startsOn = input.startsOn ?? (course.starts_on > today ? course.starts_on : today);
    if (startsOn < today) throw new RuleViolationError('Start date cannot be in the past');
    if (course.ends_on && startsOn > course.ends_on) throw new RuleViolationError('Course has ended by that date');

    if ((await seatsOpenToNewcomers(tx, course, today)) <= 0) {
      throw new RuleViolationError('Course is full', { waitlistAvailable: true });
    }
    const row = await createEnrollmentLocked(tx, user, course, student, startsOn);
    return (await repo.findEnrollmentView(tx, user.orgId, row.id))!;
  });

// withdrawal takes effect at the end of the current billing period unless staff override
const defaultEffectiveDate = (cycle: string | null, today: string, termEndsOn: string | null, courseEndsOn: string | null): string => {
  let d: string;
  if (cycle === 'per_term' && termEndsOn) d = termEndsOn;
  else if (cycle === 'monthly') d = monthEnd(today);
  else d = today;
  if (courseEndsOn && d > courseEndsOn) d = courseEndsOn;
  return d;
};

// when a withdrawal requested today would take effect, by exactly the rule withdraw applies.
// null when there is nothing to withdraw from
const withdrawPreview = (e: { status: string; ends_on: string | null; starts_on: string; fee_billing_cycle: string | null; term_ends_on: string | null; course_ends_on: string | null }, today: string): string | null => {
  if (e.status !== 'active' || e.ends_on !== null) return null;
  const d = defaultEffectiveDate(e.fee_billing_cycle, today, e.term_ends_on, e.course_ends_on);
  return d < e.starts_on ? e.starts_on : d;
};

// the single enrollment read, with the withdrawal preview. getenrollment stays as the plain
// access check that attendancehistory reuses
export const getEnrollmentDetail = async (user: AuthUser, id: string) => {
  const e = await getEnrollment(user, id);
  const { timezone } = await repo.orgContext(pool, user.orgId);
  return { ...e, withdraw_effective_on: withdrawPreview(e, todayIn(timezone)) };
};

export const withdraw = (user: AuthUser, id: string, input: { effectiveOn?: string; reason?: string }) =>
  withTransaction(async tx => {
    const before = await repo.findEnrollmentForUpdate(tx, user.orgId, id);
    if (!before || before.status !== 'active') throw new NotFoundError('Active enrollment');
    await assertStudentAccess(tx, user, before.student_id);
    const course = (await repo.lockCourse(tx, user.orgId, before.course_id))!;
    assertBranch(user, course.branch_id);
    const { timezone } = await repo.orgContext(tx, user.orgId);
    const today = todayIn(timezone);

    let effectiveOn = defaultEffectiveDate(course.billing_cycle, today, course.term_ends_on, course.ends_on);
    if (input.effectiveOn !== undefined) {
      if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError('Only staff can choose the effective date');
      if (input.effectiveOn < today) throw new RuleViolationError('Effective date cannot be in the past');
      effectiveOn = input.effectiveOn;
    }
    if (effectiveOn < before.starts_on) effectiveOn = before.starts_on;

    const after = await repo.withdrawEnrollment(tx, id, effectiveOn, effectiveOn <= today, input.reason ?? null);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'enrollment.withdrawn', entityType: 'enrollment', entityId: id, before, after });
    if (effectiveOn <= today) await offerNextIfSeat(tx, user.orgId, course.id, today);
    return (await repo.findEnrollmentView(tx, user.orgId, id))!;
  });

// waitlist --------------------------------------------------------------------

// if a seat is free and nobody currently holds an offer, offer to the head of the queue
export const offerNextIfSeat = async (tx: PoolClient, orgId: string, courseId: string, today: string): Promise<void> => {
  const course = await repo.lockCourse(tx, orgId, courseId);
  if (!course || course.status !== 'open') return;
  if (await repo.hasOpenOffer(tx, courseId)) return;
  if ((await repo.seatsTaken(tx, courseId, seatDate(course, today))) >= course.capacity) return;
  const head = await repo.headOfQueue(tx, courseId);
  if (!head) return;
  const { waitlist_offer_hours } = await repo.orgContext(tx, orgId);
  const expiresAt = new Date(Date.now() + waitlist_offer_hours * 3_600_000);
  await repo.offerWaitlist(tx, head.id, expiresAt);
  await writeAudit(tx, { orgId, actorUserId: null, action: 'waitlist.offered', entityType: 'waitlist_entry', entityId: head.id, after: { expiresAt } });
  await notifyGuardians(tx, orgId, head.student_id, 'waitlist_offer', 'waitlist_offer_v1', { waitlistId: head.id, courseName: course.name, expiresAt }, `waitlist_offer:${head.id}`);
};

export const listWaitlist = (user: AuthUser, f: { courseId?: string; studentId?: string }) => {
  if (user.role === 'parent') return repo.listWaitlist(pool, user.orgId, { ...f, guardianId: user.id });
  if (user.role === 'tutor') throw new ForbiddenError();
  return repo.listWaitlist(pool, user.orgId, f);
};

export const joinWaitlist = (user: AuthUser, input: { studentId: string; courseId: string }) =>
  withTransaction(async tx => {
    const student = await assertStudentAccess(tx, user, input.studentId);
    const course = await repo.lockCourse(tx, user.orgId, input.courseId);
    if (!course || course.status !== 'open') throw new NotFoundError('Open course');
    if (course.level_id && course.level_id !== student.level_id) throw new RuleViolationError('This course is for a different level');
    const { timezone } = await repo.orgContext(tx, user.orgId);
    const today = todayIn(timezone);
    if ((await seatsOpenToNewcomers(tx, course, today)) > 0) throw new RuleViolationError('Seats are available; enroll directly');
    try {
      const row = await repo.insertWaitlist(tx, user.orgId, student.id, course.id);
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'waitlist.joined', entityType: 'waitlist_entry', entityId: row.id, after: row });
      return (await repo.findWaitlistView(tx, user.orgId, row.id))!;
    } catch (err) {
      if (isUniqueViolation(err, 'waitlist_entries_one_open_per_course_uq')) throw new ConflictError('Already on the waitlist for this course');
      throw err;
    }
  });

export const acceptOffer = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const entry = await repo.findWaitlistForUpdate(tx, user.orgId, id);
    if (!entry) throw new NotFoundError('Waitlist entry');
    const student = await assertStudentAccess(tx, user, entry.student_id);
    if (entry.status !== 'offered') throw new RuleViolationError(`No open offer (status is ${entry.status})`);
    if (entry.offer_expires_at && entry.offer_expires_at.getTime() < Date.now()) throw new RuleViolationError('The offer has expired');
    const course = (await repo.lockCourse(tx, user.orgId, entry.course_id))!;
    const { timezone } = await repo.orgContext(tx, user.orgId);
    const today = todayIn(timezone);
    if ((await repo.seatsTaken(tx, course.id, seatDate(course, today))) >= course.capacity) throw new RuleViolationError('The seat is no longer available');
    const enrollment = await createEnrollmentLocked(tx, user, course, student, today);
    await repo.setWaitlistStatus(tx, id, 'accepted');
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'waitlist.accepted', entityType: 'waitlist_entry', entityId: id, after: { enrollmentId: enrollment.id } });
    return (await repo.findEnrollmentView(tx, user.orgId, enrollment.id))!;
  });

export const leaveWaitlist = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const entry = await repo.findWaitlistForUpdate(tx, user.orgId, id);
    if (!entry || !['waiting', 'offered'].includes(entry.status)) throw new NotFoundError('Open waitlist entry');
    await assertStudentAccess(tx, user, entry.student_id);
    await repo.setWaitlistStatus(tx, id, 'withdrawn');
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'waitlist.withdrawn', entityType: 'waitlist_entry', entityId: id, before: entry });
    if (entry.status === 'offered') {
      const { timezone } = await repo.orgContext(tx, user.orgId);
      await offerNextIfSeat(tx, user.orgId, entry.course_id, todayIn(timezone));
    }
    return (await repo.findWaitlistView(tx, user.orgId, id))!;
  });

// attendance --------------------------------------------------------------------

const loadSessionForAttendance = async (q: Queryable, user: AuthUser, sessionId: string, write: boolean) => {
  const s = await repo.findSession(q, user.orgId, sessionId);
  if (!s) throw new NotFoundError('Session');
  if (user.role === 'parent') throw new ForbiddenError();
  if (user.role === 'tutor' && s.tutor_id !== user.id) throw new ForbiddenError('Not your session');
  if (user.role === 'branch_manager' && !user.branchIds.includes(s.branch_id)) throw new ForbiddenError('You do not manage that branch');
  if (write) {
    if (s.status === 'cancelled') throw new RuleViolationError('Session was cancelled');
    if (s.starts_at.getTime() > Date.now()) throw new RuleViolationError('Session has not started yet');
    if (user.role === 'tutor') {
      const { attendance_edit_window_days } = await repo.orgContext(q, user.orgId);
      if (Date.now() - s.ends_at.getTime() > attendance_edit_window_days * 86_400_000) throw new RuleViolationError(`Attendance can only be edited within ${attendance_edit_window_days} days`);
    }
  }
  return s;
};

export const getRoster = async (user: AuthUser, sessionId: string) => {
  await loadSessionForAttendance(pool, user, sessionId, false);
  return repo.roster(pool, sessionId);
};

const makeupExpiry = (ctx: Awaited<ReturnType<typeof repo.orgContext>>, today: string, termEndsOn: string | null, courseEndsOn: string | null) => {
  if (ctx.makeup_expiry_policy === 'end_of_term') return termEndsOn ?? courseEndsOn ?? addDays(today, ctx.makeup_expiry_days);
  return addDays(today, ctx.makeup_expiry_days);
};

export const markAttendance = (user: AuthUser, sessionId: string, records: Array<{ studentId: string; status: 'present' | 'absent' | 'late' | 'excused'; notes: string | null }>) =>
  withTransaction(async tx => {
    const session = await loadSessionForAttendance(tx, user, sessionId, true);
    const ctx = await repo.orgContext(tx, user.orgId);
    const today = todayIn(ctx.timezone);
    const roster = new Map((await repo.roster(tx, sessionId)).map(r => [r.student_id, r]));
    const course = (await repo.lockCourse(tx, user.orgId, session.course_id))!;
    const results = [];

    for (const r of records) {
      const member = roster.get(r.studentId);
      if (!member) throw new RuleViolationError(`Student ${r.studentId} is not on this session's roster`);
      const previous = (await repo.existingAttendanceStatus(tx, sessionId, r.studentId))?.status ?? null;
      const row = await repo.upsertAttendance(tx, user.orgId, {
        session_id: sessionId, student_id: r.studentId, enrollment_id: member.enrollment_id, makeup_booking_id: member.makeup_booking_id,
        status: r.status, notes: r.notes, marked_by: user.id,
      });
      if (previous !== r.status) {
        await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: previous ? 'attendance.changed' : 'attendance.marked', entityType: 'attendance', entityId: row.id, before: { status: previous }, after: { status: r.status, studentId: r.studentId, sessionId } });
      }
      // make up credit follows the org policy, a later correction to present forfeits an unused credit
      if (member.source === 'enrollment') {
        if (ctx.makeup_eligible_statuses.includes(r.status)) {
          const created = await repo.insertMakeup(tx, user.orgId, { student_id: r.studentId, credited_from_session_id: sessionId, expires_on: makeupExpiry(ctx, today, course.term_ends_on, course.ends_on), granted_by: user.id });
          if (created) await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'makeup.granted', entityType: 'makeup_booking', entityId: created.id, after: { studentId: r.studentId, sessionId } });
        } else if (previous && ctx.makeup_eligible_statuses.includes(previous)) {
          await repo.forfeitAvailableCredit(tx, r.studentId, sessionId);
        }
      } else if (member.makeup_booking_id) {
        // the credit is consumed either way: attending uses it, missing the booked session burns it
        await repo.setMakeupStatus(tx, member.makeup_booking_id, ['present', 'late'].includes(r.status) ? 'used' : 'forfeited', undefined);
      }
      if (r.status === 'absent' && previous !== 'absent') {
        await notifyGuardians(tx, user.orgId, r.studentId, 'student_absent', 'student_absent_v1', { sessionId, courseName: session.course_name, startsAt: session.starts_at, studentName: member.student_name }, `student_absent:${sessionId}:${r.studentId}`);
      }
      results.push(row);
    }
    return { marked: results.length, roster: await repo.roster(tx, sessionId) };
  });

// make ups --------------------------------------------------------------------

export const listMakeups = (user: AuthUser, f: { studentId?: string; status?: string }) => {
  if (user.role === 'parent') return repo.listMakeups(pool, user.orgId, { ...f, guardianId: user.id });
  if (user.role === 'tutor') throw new ForbiddenError();
  return repo.listMakeups(pool, user.orgId, f);
};

// shared by the options read and the booking write so both report the cap identically.
// counts credits already committed, not credits granted: a student may accumulate many
// excused absences, the cap limits how many they can actually claim back
const assertMakeupCap = async (q: Queryable, orgId: string, cap: number | null, studentId: string, creditedFromSessionId: string) => {
  if (cap === null) return;
  const used = await repo.countMakeupsInSameTerm(q, orgId, studentId, creditedFromSessionId);
  if (used >= cap) throw new RuleViolationError(`This student has used ${used} of ${cap} make-ups allowed this term`);
};

export const makeupOptions = async (user: AuthUser, id: string) => {
  const m = await repo.findMakeupView(pool, user.orgId, id);
  if (!m) throw new NotFoundError('Make-up credit');
  await assertStudentAccess(pool, user, m.student_id);
  if (m.status !== 'available') throw new RuleViolationError(`Credit is ${m.status}`);
  const ctx = await repo.orgContext(pool, user.orgId);
  // checked on the read as well as the write so the screen can explain an empty list
  await assertMakeupCap(pool, user.orgId, ctx.makeup_cap_per_term, m.student_id, m.credited_from_session_id);
  const missed = (await repo.findSession(pool, user.orgId, m.credited_from_session_id))!;
  return repo.makeupOptions(pool, user.orgId, m.student_id, missed.subject_id, missed.level_id, m.expires_on, ctx.makeup_min_lead_minutes);
};

export const bookMakeup = (user: AuthUser, id: string, sessionId: string) =>
  withTransaction(async tx => {
    const m = await repo.findMakeupForUpdate(tx, user.orgId, id);
    if (!m) throw new NotFoundError('Make-up credit');
    await assertStudentAccess(tx, user, m.student_id);
    if (m.status !== 'available') throw new RuleViolationError(`Credit is ${m.status}`);
    const ctx = await repo.orgContext(tx, user.orgId);
    await assertMakeupCap(tx, user.orgId, ctx.makeup_cap_per_term, m.student_id, m.credited_from_session_id);
    const missed = (await repo.findSession(tx, user.orgId, m.credited_from_session_id))!;
    // the notice period lives inside the options query, so a session starting too soon is
    // simply not an option and the membership check below rejects it
    const options = await repo.makeupOptions(tx, user.orgId, m.student_id, missed.subject_id, missed.level_id, m.expires_on, ctx.makeup_min_lead_minutes);
    const target = options.find(o => o.id === sessionId);
    if (!target) throw new RuleViolationError('That session is not available for this credit');
    if (target.seats_left <= 0) throw new RuleViolationError('That session is full');
    await repo.setMakeupStatus(tx, id, 'booked', sessionId);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'makeup.booked', entityType: 'makeup_booking', entityId: id, after: { sessionId } });
    return (await repo.findMakeupView(tx, user.orgId, id))!;
  });

export const unbookMakeup = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const m = await repo.findMakeupForUpdate(tx, user.orgId, id);
    if (!m || m.status !== 'booked' || !m.booked_session_id) throw new NotFoundError('Booked make-up');
    await assertStudentAccess(tx, user, m.student_id);
    const s = (await repo.findSession(tx, user.orgId, m.booked_session_id))!;
    if (s.starts_at.getTime() <= Date.now()) throw new RuleViolationError('Session has already started');
    const { timezone } = await repo.orgContext(tx, user.orgId);
    await repo.setMakeupStatus(tx, id, m.expires_on >= todayIn(timezone) ? 'available' : 'expired', null);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'makeup.unbooked', entityType: 'makeup_booking', entityId: id, before: { sessionId: m.booked_session_id } });
    return (await repo.findMakeupView(tx, user.orgId, id))!;
  });

// called by scheduling.cancelsession inside its transaction
export const releaseMakeupsForSession = async (tx: PoolClient, orgId: string, sessionId: string): Promise<number> => {
  const { timezone } = await repo.orgContext(tx, orgId);
  const released = await repo.releaseBookingsForSession(tx, sessionId, todayIn(timezone));
  for (const r of released) {
    await writeAudit(tx, { orgId, actorUserId: null, action: 'makeup.released', entityType: 'makeup_booking', entityId: r.id, after: { sessionId } });
  }
  return released.length;
};

// jobs --------------------------------------------------------------------

export const runLifecycleJob = async (orgId: string) => {
  const ctx = await repo.orgContext(pool, orgId);
  const today = todayIn(ctx.timezone);
  const settled = await withTransaction(tx => repo.settleEndedEnrollments(tx, today));
  const expiredCredits = await withTransaction(tx => repo.expireMakeups(tx, today));
  // credits booked into a session nobody marked attendance for, past the edit window
  const strandedCredits = await withTransaction(async tx => {
    const rows = await repo.forfeitUnmarkedBookings(tx, ctx.attendance_edit_window_days);
    for (const r of rows) {
      await writeAudit(tx, { orgId, actorUserId: null, action: 'makeup.forfeited_unmarked', entityType: 'makeup_booking', entityId: r.id, after: { sessionId: r.booked_session_id } });
    }
    return rows.length;
  });
  let expiredOffers = 0;
  const touchedCourses = new Set<string>();
  await withTransaction(async tx => {
    for (const e of await repo.expiredOffers(tx)) {
      await repo.setWaitlistStatus(tx, e.id, 'expired');
      await writeAudit(tx, { orgId, actorUserId: null, action: 'waitlist.offer_expired', entityType: 'waitlist_entry', entityId: e.id });
      touchedCourses.add(e.course_id);
      expiredOffers++;
    }
  });
  // seats freed by settled withdrawals or expired offers go to the next in line
  const courses = new Set<string>(touchedCourses);
  for (const e of await repo.listEnrollments(pool, orgId, { status: 'withdrawn' })) if (e.ends_on === addDays(today, -1)) courses.add(e.course_id);
  for (const courseId of courses) await withTransaction(tx => offerNextIfSeat(tx, orgId, courseId, today));
  return { settled, expiredCredits, strandedCredits, expiredOffers, coursesReoffered: courses.size };
};