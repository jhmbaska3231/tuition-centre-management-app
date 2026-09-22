// backend/src/modules/scheduling/service.ts

import { PoolClient } from 'pg';
import { isExclusionViolation, pool, withTransaction, Queryable } from '../../db';
import { ConflictError, ForbiddenError, NotFoundError, RuleViolationError } from '../../http/errors';
import { addDays, addMinutes, dateInZone, todayIn, toInstant, weekdayOf } from '../../lib/time';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { enqueue, enqueueForRole, enqueueForSessionGuardians } from '../notifications/outbox';
import { generateForCourse } from './generator';
import * as repo from './repository';
import { CourseRow, SessionRow, SessionView } from './types';
import { offerNextIfSeat, releaseMakeupsForSession } from '../enrollment/service';

const STAFF_WRITE = new Set(['admin', 'branch_manager']);

const assertBranch = (user: AuthUser, branchId: string) => {
  if (user.role === 'admin' || user.branchIds.includes(branchId)) return;
  throw new ForbiddenError('You do not manage that branch');
};

const translateConflict = (err: unknown): never => {
  if (isExclusionViolation(err, 'sessions_no_tutor_overlap')) throw new ConflictError('The tutor already has a session at that time');
  if (isExclusionViolation(err, 'sessions_no_classroom_overlap')) throw new ConflictError('The classroom is already booked at that time');
  throw err;
};

// soft warnings returned alongside the result so the ui can show them without blocking
const warningsFor = async (q: Queryable, orgId: string, tutorId: string | null, branchId: string, startsAt: Date, endsAt: Date, excludeSessionId: string | null): Promise<string[]> => {
  if (!tutorId) return ['No tutor assigned'];
  const warnings: string[] = [];
  const zone = await repo.orgTimezone(q, orgId);
  const date = dateInZone(startsAt, zone);
  const hhmm = (d: Date) => new Date(d).toLocaleTimeString('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
  const avail = await repo.tutorAvailableAt(q, tutorId, weekdayOf(date), hhmm(startsAt), hhmm(endsAt));
  if (avail === false) warnings.push('Tutor has not marked themselves available at this time');
  const { travel_buffer_minutes } = await repo.orgSettings(q, orgId);
  const adjacent = await repo.adjacentSessionsAtOtherBranch(q, tutorId, branchId, startsAt, endsAt, travel_buffer_minutes, excludeSessionId);
  for (const a of adjacent) warnings.push(`Within ${travel_buffer_minutes} min of "${a.course_name}" at ${a.branch_name}`);
  return warnings;
};

// terms ----------------------------------------------------------------------------

export const listTerms = (orgId: string) => repo.listTerms(pool, orgId);
export const createTerm = (user: AuthUser, input: { name: string; starts_on: string; ends_on: string }) =>
  withTransaction(async tx => {
    const row = await repo.insertTerm(tx, user.orgId, input);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'term.created', entityType: 'term', entityId: row.id, after: row });
    return row;
  });
export const updateTerm = (user: AuthUser, id: string, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    const before = await repo.findTerm(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Term');
    const after = await repo.updateTerm(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'term.updated', entityType: 'term', entityId: id, before, after });
    return after;
  });
export const archiveTerm = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findTerm(tx, user.orgId, id);
    if (!before || before.archived_at) throw new NotFoundError('Term');
    const after = await repo.archiveTerm(tx, user.orgId, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'term.archived', entityType: 'term', entityId: id, before });
    return after;
  });

// courses ----------------------------------------------------------------------------

const assertCourseRefs = async (q: Queryable, orgId: string, c: {
  branch_id: string; subject_id?: string; level_id?: string | null; term_id?: string | null; fee_plan_id?: string | null;
  default_tutor_id?: string | null; default_classroom_id?: string | null; capacity?: number; starts_on?: string; ends_on?: string | null;
}) => {
  if (c.subject_id && !(await repo.exists(q, 'subjects', orgId, c.subject_id))) throw new RuleViolationError('Subject does not exist');
  if (c.level_id && !(await repo.exists(q, 'levels', orgId, c.level_id))) throw new RuleViolationError('Level does not exist');
  if (c.fee_plan_id && !(await repo.exists(q, 'fee_plans', orgId, c.fee_plan_id))) throw new RuleViolationError('Fee plan does not exist');
  if (c.default_tutor_id && !(await repo.findActiveTutor(q, orgId, c.default_tutor_id))) throw new RuleViolationError('Tutor does not exist or is not active');
  if (c.term_id) {
    const term = await repo.findTerm(q, orgId, c.term_id);
    if (!term || term.archived_at) throw new RuleViolationError('Term does not exist');
    if (c.starts_on && c.starts_on < term.starts_on) throw new RuleViolationError('Course starts before the term');
    if (c.ends_on && c.ends_on > term.ends_on) throw new RuleViolationError('Course ends after the term');
  }
  if (c.default_classroom_id) {
    const room = await repo.findClassroom(q, orgId, c.default_classroom_id);
    if (!room || room.archived_at) throw new RuleViolationError('Classroom does not exist');
    if (room.branch_id !== c.branch_id) throw new RuleViolationError('Classroom belongs to a different branch');
    if (c.capacity && c.capacity > room.capacity) throw new RuleViolationError(`Course capacity exceeds classroom capacity (${room.capacity})`);
  }
};

const assertSlotsDoNotOverlap = (slots: Array<{ weekday: number; start_time: string; duration_minutes: number }>) => {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i], b = slots[j];
    if (a.weekday === b.weekday && mins(a.start_time) < mins(b.start_time) + b.duration_minutes && mins(b.start_time) < mins(a.start_time) + a.duration_minutes) {
      throw new RuleViolationError('Two slots on the same weekday overlap');
    }
  }
};

export const listCourses = (user: AuthUser, f: repo.CourseFilters & { studentId?: string }) => {
  if (user.role === 'parent') return repo.listCoursesForParent(pool, user.orgId, user.id, f.studentId ?? null, f);
  if (user.role === 'tutor') return repo.listCoursesForTutor(pool, user.orgId, user.id);
  return repo.listCourses(pool, user.orgId, f);
};

export const getCourse = async (user: AuthUser, id: string) => {
  const c = await repo.findCourseView(pool, user.orgId, id);
  if (!c) throw new NotFoundError('Course');
  if (user.role === 'parent' && c.status !== 'open') throw new NotFoundError('Course');
  return c;
};

export const createCourse = async (user: AuthUser, input: Omit<repo.InsertCourseInput, 'created_by'> & { slots: Array<{ weekday: number; start_time: string; duration_minutes: number }> }) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  assertBranch(user, input.branch_id);
  assertSlotsDoNotOverlap(input.slots);
  const view = await withTransaction(async tx => {
    if (!(await repo.exists(tx, 'branches', user.orgId, input.branch_id))) throw new RuleViolationError('Branch does not exist');
    await assertCourseRefs(tx, user.orgId, input);
    const row = await repo.insertCourse(tx, user.orgId, { ...input, created_by: user.id });
    for (const s of input.slots) await repo.insertSlot(tx, row.id, s);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'course.created', entityType: 'course', entityId: row.id, after: { ...row, slots: input.slots } });
    return (await repo.findCourseView(tx, user.orgId, row.id))!;
  });
  return { course: view, generation: null };
};

export const updateCourse = (user: AuthUser, id: string, fields: Record<string, unknown>) =>
  withTransaction(async tx => {
    const before = await repo.findCourseForUpdate(tx, user.orgId, id);
    if (!before || before.status === 'archived') throw new NotFoundError('Course');
    if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
    assertBranch(user, before.branch_id);
    const merged = { ...before, ...fields } as CourseRow;
    await assertCourseRefs(tx, user.orgId, merged);
    if (fields.capacity !== undefined) {
      const active = (await repo.findCourseView(tx, user.orgId, id))!.active_enrollment_count;
      if ((fields.capacity as number) < active) throw new RuleViolationError(`Capacity cannot be below current enrollment (${active})`);
    }
    const after = await repo.updateCourse(tx, user.orgId, id, fields);
    if (fields.capacity !== undefined && (fields.capacity as number) > before.capacity) {
      await offerNextIfSeat(tx, user.orgId, id, todayIn(await repo.orgTimezone(tx, user.orgId)));
    }
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'course.updated', entityType: 'course', entityId: id, before, after });
    // existing sessions keep their own tutor/classroom. only future generation picks up new defaults
    return (await repo.findCourseView(tx, user.orgId, id))!;
  });

export const setCourseStatus = async (user: AuthUser, id: string, status: 'open' | 'closed' | 'archived') => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  const row = await withTransaction(async tx => {
    const before = await repo.findCourseForUpdate(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Course');
    assertBranch(user, before.branch_id);
    if (before.status === status) return before;
    if (status === 'archived') {
      const view = (await repo.findCourseView(tx, user.orgId, id))!;
      if (view.active_enrollment_count > 0) throw new RuleViolationError('Withdraw all active enrollments before archiving');
    }
    if (status === 'open' && before.status === 'archived') throw new RuleViolationError('Archived courses cannot be reopened');
    const after = await repo.updateCourse(tx, user.orgId, id, { status });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: `course.${status}`, entityType: 'course', entityId: id, before: { status: before.status } });
    return after;
  });
  const generation = status === 'open' ? await generateForCourse(user.orgId, row, user.id) : null;
  return { course: (await repo.findCourseView(pool, user.orgId, id))!, generation };
};

export const addSlot = async (user: AuthUser, courseId: string, slot: { weekday: number; start_time: string; duration_minutes: number }) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  const course = await withTransaction(async tx => {
    const c = await repo.findCourseForUpdate(tx, user.orgId, courseId);
    if (!c || c.status === 'archived') throw new NotFoundError('Course');
    assertBranch(user, c.branch_id);
    assertSlotsDoNotOverlap([...(await repo.listSlots(tx, courseId)), slot]);
    const row = await repo.insertSlot(tx, courseId, slot);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'course.slot_added', entityType: 'course', entityId: courseId, after: row });
    return c;
  });
  const generation = await generateForCourse(user.orgId, course, user.id);
  return { course: (await repo.findCourseView(pool, user.orgId, courseId))!, generation };
};

export const removeSlot = (user: AuthUser, courseId: string, slotId: string) =>
  withTransaction(async tx => {
    if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
    const c = await repo.findCourseForUpdate(tx, user.orgId, courseId);
    if (!c) throw new NotFoundError('Course');
    assertBranch(user, c.branch_id);
    const slot = await repo.findSlot(tx, courseId, slotId);
    if (!slot) throw new NotFoundError('Slot');
    if ((await repo.listSlots(tx, courseId)).length <= 1) throw new RuleViolationError('A course needs at least one slot');
    const future = await repo.countFutureSessionsForSlot(tx, slotId);
    if (future > 0) throw new RuleViolationError(`Cancel ${future} upcoming session(s) on this slot first`);
    await repo.deleteSlot(tx, slotId);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'course.slot_removed', entityType: 'course', entityId: courseId, before: slot });
    return (await repo.findCourseView(tx, user.orgId, courseId))!;
  });

export const regenerate = async (user: AuthUser, courseId: string) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  const c = await repo.findCourse(pool, user.orgId, courseId);
  if (!c) throw new NotFoundError('Course');
  assertBranch(user, c.branch_id);
  return generateForCourse(user.orgId, c, user.id);
};

// sessions ----------------------------------------------------------------------------

export const listSessions = async (user: AuthUser, f: { from: string; to: string; courseId?: string; branchId?: string; tutorId?: string; classroomId?: string; status?: string }) => {
  const zone = await repo.orgTimezone(pool, user.orgId);
  const range = { from: toInstant(f.from, '00:00', zone), to: toInstant(addDays(f.to, 1), '00:00', zone) };
  if (user.role === 'parent') return repo.listSessions(pool, user.orgId, { ...range, courseId: f.courseId, parentId: user.id });
  if (user.role === 'tutor') return repo.listSessions(pool, user.orgId, { ...range, courseId: f.courseId, status: f.status, tutorId: user.id });
  return repo.listSessions(pool, user.orgId, { ...f, ...range });
};

export const getSession = async (user: AuthUser, id: string): Promise<SessionView> => {
  const s = await repo.findSessionView(pool, user.orgId, id);
  if (!s) throw new NotFoundError('Session');
  if (user.role === 'tutor' && s.tutor_id !== user.id) throw new NotFoundError('Session');
  // parents may only read a session their child attends or has a make up booked into
  if (user.role === 'parent' && !(await repo.parentCanSeeSession(pool, user.orgId, id, user.id))) throw new NotFoundError('Session');
  return s;
};

export const listNeedingCover = (user: AuthUser) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  return repo.listSessionsNeedingCover(pool, user.orgId, user.role === 'admin' ? null : user.branchIds);
};

export const createAdhocSession = async (user: AuthUser, input: { course_id: string; date: string; start_time: string; duration_minutes: number; tutor_id: string | null; classroom_id: string | null }) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  try {
    return await withTransaction(async tx => {
      const course = await repo.findCourse(tx, user.orgId, input.course_id);
      if (!course || course.status !== 'open') throw new NotFoundError('Open course');
      assertBranch(user, course.branch_id);
      const [zone, settings] = await Promise.all([repo.orgTimezone(tx, user.orgId), repo.orgSettings(tx, user.orgId)]);
      const startsAt = toInstant(input.date, input.start_time, zone);
      const endsAt = addMinutes(startsAt, input.duration_minutes);
      const leadMinutes = (startsAt.getTime() - Date.now()) / 60_000;
      if (leadMinutes < settings.adhoc_min_lead_minutes) throw new RuleViolationError(`Sessions must start at least ${settings.adhoc_min_lead_minutes} minutes from now`);
      if (input.date > addDays(todayIn(zone), settings.adhoc_max_lead_days)) throw new RuleViolationError(`Sessions can be scheduled at most ${settings.adhoc_max_lead_days} days ahead`);
      const tutorId = input.tutor_id ?? course.default_tutor_id;
      const classroomId = input.classroom_id ?? course.default_classroom_id;
      await assertCourseRefs(tx, user.orgId, { branch_id: course.branch_id, default_tutor_id: tutorId, default_classroom_id: classroomId, capacity: course.capacity });
      const row = await repo.insertSession(tx, user.orgId, { course_id: course.id, slot_id: null, starts_at: startsAt, ends_at: endsAt, tutor_id: tutorId, classroom_id: classroomId, is_adhoc: true, created_by: user.id });
      if (!row) throw new ConflictError('A session for this course already exists at that time');
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'session.created_adhoc', entityType: 'session', entityId: row.id, after: row });
      const warnings = await warningsFor(tx, user.orgId, tutorId, course.branch_id, startsAt, endsAt, row.id);
      return { session: (await repo.findSessionView(tx, user.orgId, row.id))!, warnings };
    });
  } catch (err) { return translateConflict(err); }
};

const loadScheduledForUpdate = async (tx: PoolClient, user: AuthUser, id: string): Promise<SessionRow & { branch_id: string }> => {
  const s = await repo.findSessionForUpdate(tx, user.orgId, id);
  if (!s) throw new NotFoundError('Session');
  if (s.status !== 'scheduled') throw new RuleViolationError(`Session is ${s.status}`);
  if (s.starts_at.getTime() <= Date.now()) throw new RuleViolationError('Session has already started');
  const course = (await repo.findCourse(tx, user.orgId, s.course_id))!;
  assertBranch(user, course.branch_id);
  return { ...s, branch_id: course.branch_id };
};

export const rescheduleSession = async (user: AuthUser, id: string, input: { date?: string; start_time?: string; duration_minutes?: number; classroom_id?: string | null; tutor_id?: string | null }) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  try {
    return await withTransaction(async tx => {
      const before = await loadScheduledForUpdate(tx, user, id);
      const zone = await repo.orgTimezone(tx, user.orgId);
      const date = input.date ?? dateInZone(before.starts_at, zone);
      const time = input.start_time ?? new Date(before.starts_at).toLocaleTimeString('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
      const startsAt = toInstant(date, time, zone);
      const duration = input.duration_minutes ?? Math.round((before.ends_at.getTime() - before.starts_at.getTime()) / 60_000);
      const endsAt = addMinutes(startsAt, duration);
      const tutorId = input.tutor_id === undefined ? before.tutor_id : input.tutor_id;
      const classroomId = input.classroom_id === undefined ? before.classroom_id : input.classroom_id;
      const course = (await repo.findCourse(tx, user.orgId, before.course_id))!;
      await assertCourseRefs(tx, user.orgId, { branch_id: course.branch_id, default_tutor_id: tutorId, default_classroom_id: classroomId, capacity: course.capacity });

      const after = await repo.updateSession(tx, user.orgId, id, { starts_at: startsAt, ends_at: endsAt, tutor_id: tutorId, classroom_id: classroomId });
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'session.rescheduled', entityType: 'session', entityId: id, before, after });

      const timeChanged = startsAt.getTime() !== before.starts_at.getTime() || endsAt.getTime() !== before.ends_at.getTime();
      if (timeChanged) await enqueueForSessionGuardians(tx, user.orgId, id, 'session_rescheduled', 'session_rescheduled_v1', { sessionId: id, courseName: course.name, from: before.starts_at, to: startsAt });
      if (tutorId !== before.tutor_id) {
        await enqueueForSessionGuardians(tx, user.orgId, id, 'tutor_changed', 'tutor_changed_v1', { sessionId: id, courseName: course.name, startsAt });
        if (tutorId) await enqueue(tx, { orgId: user.orgId, recipientUserId: tutorId, eventKey: 'tutor_changed', template: 'tutor_assigned_v1', payload: { sessionId: id, courseName: course.name, startsAt }, dedupeKey: `tutor_assigned:${id}:${tutorId}` });
      }
      const warnings = await warningsFor(tx, user.orgId, tutorId, course.branch_id, startsAt, endsAt, id);
      return { session: (await repo.findSessionView(tx, user.orgId, id))!, warnings };
    });
  } catch (err) { return translateConflict(err); }
};

export const cancelSession = async (user: AuthUser, id: string, reason: string) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  return withTransaction(async tx => {
    const before = await loadScheduledForUpdate(tx, user, id);
    const course = (await repo.findCourse(tx, user.orgId, before.course_id))!;
    await repo.updateSession(tx, user.orgId, id, { status: 'cancelled', cancel_reason: reason });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'session.cancelled', entityType: 'session', entityId: id, before, after: { reason } });
    const notified = await enqueueForSessionGuardians(tx, user.orgId, id, 'session_cancelled', 'session_cancelled_v1', { sessionId: id, courseName: course.name, startsAt: before.starts_at, reason });
    const released = await releaseMakeupsForSession(tx, user.orgId, id);
    return { session: (await repo.findSessionView(tx, user.orgId, id))!, guardiansNotified: notified, makeupsReleased: released };
  });
};

export const assignCover = async (user: AuthUser, id: string, tutorId: string) => {
  if (!STAFF_WRITE.has(user.role)) throw new ForbiddenError();
  try {
    return await withTransaction(async tx => {
      const before = await loadScheduledForUpdate(tx, user, id);
      const tutor = await repo.findActiveTutor(tx, user.orgId, tutorId);
      if (!tutor) throw new RuleViolationError('Tutor does not exist or is not active');
      const course = (await repo.findCourse(tx, user.orgId, before.course_id))!;
      const zone = await repo.orgTimezone(tx, user.orgId);
      // link to the leave that caused the gap, if there is one, for reporting
      const leave = before.tutor_id ? await repo.overlappingLeave(tx, before.tutor_id, dateInZone(before.starts_at, zone), dateInZone(before.starts_at, zone)) : null;
      const after = await repo.updateSession(tx, user.orgId, id, { tutor_id: tutorId, cover_for_leave_id: leave?.id ?? null });
      await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'session.cover_assigned', entityType: 'session', entityId: id, before: { tutor_id: before.tutor_id }, after: { tutor_id: tutorId, leave_id: leave?.id ?? null } });
      await enqueueForSessionGuardians(tx, user.orgId, id, 'tutor_changed', 'tutor_changed_v1', { sessionId: id, courseName: course.name, startsAt: before.starts_at, tutorName: `${tutor.first_name} ${tutor.last_name}` });
      await enqueue(tx, { orgId: user.orgId, recipientUserId: tutorId, eventKey: 'tutor_changed', template: 'tutor_assigned_v1', payload: { sessionId: id, courseName: course.name, startsAt: before.starts_at }, dedupeKey: `tutor_assigned:${id}:${tutorId}` });
      const warnings = await warningsFor(tx, user.orgId, tutorId, course.branch_id, before.starts_at, before.ends_at, id);
      return { session: (await repo.findSessionView(tx, user.orgId, id))!, warnings };
    });
  } catch (err) { return translateConflict(err); }
};

export const setSessionNotes = (user: AuthUser, id: string, input: { lesson_notes?: string | null; homework?: string | null }) =>
  withTransaction(async tx => {
    const s = await repo.findSessionForUpdate(tx, user.orgId, id);
    if (!s) throw new NotFoundError('Session');
    if (user.role === 'tutor' && s.tutor_id !== user.id) throw new ForbiddenError('You can only add notes to your own sessions');
    if (user.role === 'parent') throw new ForbiddenError();
    const fields: Record<string, unknown> = {};
    if (input.lesson_notes !== undefined) fields.lesson_notes = input.lesson_notes;
    if (input.homework !== undefined) fields.homework = input.homework;
    await repo.updateSession(tx, user.orgId, id, fields);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'session.notes_updated', entityType: 'session', entityId: id, after: fields });
    return (await repo.findSessionView(tx, user.orgId, id))!;
  });

// called by the org module inside its own transaction when a closure is created
export const applyClosure = async (tx: PoolClient, orgId: string, actorId: string, closure: { id: string; branch_id: string | null; starts_on: string; ends_on: string; reason: string }) => {
  const cancelled = await repo.cancelSessionsInClosure(tx, orgId, closure.branch_id, closure.starts_on, closure.ends_on, `Closure: ${closure.reason}`);
  for (const { id } of cancelled) {
    const s = (await repo.findSessionView(tx, orgId, id))!;
    await enqueueForSessionGuardians(tx, orgId, id, 'session_cancelled', 'session_cancelled_v1', { sessionId: id, courseName: s.course_name, startsAt: s.starts_at, reason: closure.reason });
  }
  await writeAudit(tx, { orgId, actorUserId: actorId, action: 'closure.applied', entityType: 'closure', entityId: closure.id, after: { sessionsCancelled: cancelled.length } });
  return cancelled.length;
};

// availability ----------------------------------------------------------------------------

export const getAvailability = async (user: AuthUser, tutorId: string) => {
  if (user.role === 'tutor' && tutorId !== user.id) throw new ForbiddenError();
  if (user.role === 'parent') throw new ForbiddenError();
  return repo.listAvailability(pool, tutorId);
};

export const setAvailability = (user: AuthUser, tutorId: string, slots: Array<{ weekday: number; start_time: string; end_time: string }>) =>
  withTransaction(async tx => {
    if (user.role === 'tutor' && tutorId !== user.id) throw new ForbiddenError();
    if (user.role === 'parent') throw new ForbiddenError();
    if (!(await repo.findActiveTutor(tx, user.orgId, tutorId))) throw new NotFoundError('Tutor');
    await repo.replaceAvailability(tx, user.orgId, tutorId, slots);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'tutor.availability_set', entityType: 'user', entityId: tutorId, after: { slots } });
    return repo.listAvailability(tx, tutorId);
  });

// leave ----------------------------------------------------------------------------
// rules: tutor leave decided by admin or a branch manager sharing a branch, branch
// manager leave decided by admin, admin leave auto approved

const canDecide = async (q: Queryable, decider: AuthUser, requesterId: string, requesterRole: string): Promise<boolean> => {
  if (decider.role === 'admin') return true;
  if (decider.role !== 'branch_manager' || requesterRole !== 'tutor') return false;
  const tutorBranches = await repo.userBranchIds(q, requesterId);
  return tutorBranches.some(b => decider.branchIds.includes(b));
};

export const listLeave = (user: AuthUser, f: { status?: string; userId?: string }) => {
  if (user.role === 'parent') throw new ForbiddenError();
  if (user.role === 'tutor') return repo.listLeave(pool, user.orgId, { status: f.status, userId: user.id });
  if (user.role === 'branch_manager') return repo.listLeave(pool, user.orgId, { status: f.status, userId: f.userId, branchIds: user.branchIds });
  return repo.listLeave(pool, user.orgId, f);
};

export const requestLeave = (user: AuthUser, input: { starts_on: string; ends_on: string; leave_type: string; reason?: string }) =>
  withTransaction(async tx => {
    if (user.role === 'parent') throw new ForbiddenError();
    if (await repo.overlappingLeave(tx, user.id, input.starts_on, input.ends_on)) throw new ConflictError('Overlaps an existing leave request');
    const auto = user.role === 'admin';
    const row = await repo.insertLeave(tx, user.orgId, { user_id: user.id, starts_on: input.starts_on, ends_on: input.ends_on, leave_type: input.leave_type, reason: input.reason ?? null, status: auto ? 'approved' : 'pending', decided_by: auto ? user.id : null });
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'leave.requested', entityType: 'leave_request', entityId: row.id, after: row });
    if (!auto) {
      const approvers = user.role === 'tutor' ? ['admin', 'branch_manager'] : ['admin'];
      await enqueueForRole(tx, user.orgId, approvers, 'leave_request_submitted', 'leave_request_submitted_v1', { leaveId: row.id, requester: `${user.firstName} ${user.lastName}`, startsOn: row.starts_on, endsOn: row.ends_on }, `leave_submitted:${row.id}`);
    }
    return (await repo.findLeaveView(tx, user.orgId, row.id))!;
  });

export const decideLeave = (user: AuthUser, id: string, decision: 'approved' | 'rejected', note?: string) =>
  withTransaction(async tx => {
    const before = await repo.findLeaveForUpdate(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Leave request');
    if (before.status !== 'pending') throw new RuleViolationError(`Leave request is already ${before.status}`);
    if (before.user_id === user.id) throw new ForbiddenError('You cannot decide your own leave');
    const requester = (await repo.findLeaveView(tx, user.orgId, id))!;
    if (!(await canDecide(tx, user, before.user_id, requester.requester_role))) throw new ForbiddenError('You cannot approve this leave request');
    const after = await repo.decideLeave(tx, id, decision, user.id, note ?? null);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: `leave.${decision}`, entityType: 'leave_request', entityId: id, before, after });
    await enqueue(tx, { orgId: user.orgId, recipientUserId: before.user_id, eventKey: 'leave_request_decided', template: 'leave_request_decided_v1', payload: { leaveId: id, decision, note: note ?? null }, dedupeKey: `leave_decided:${id}` });
    return (await repo.findLeaveView(tx, user.orgId, id))!;
  });

export const cancelLeave = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    const before = await repo.findLeaveForUpdate(tx, user.orgId, id);
    if (!before) throw new NotFoundError('Leave request');
    if (before.user_id !== user.id && user.role !== 'admin') throw new ForbiddenError();
    if (!['pending', 'approved'].includes(before.status)) throw new RuleViolationError(`Leave request is ${before.status}`);
    const zone = await repo.orgTimezone(tx, user.orgId);
    if (before.ends_on < todayIn(zone)) throw new RuleViolationError('Past leave cannot be cancelled');
    await repo.cancelLeave(tx, id);
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'leave.cancelled', entityType: 'leave_request', entityId: id, before });
    return (await repo.findLeaveView(tx, user.orgId, id))!;
  });