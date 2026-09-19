// backend/src/modules/scheduling/generator.ts
//
// materialises sessions for open courses out to the org's horizon. idempotent: the
// unique (course_id, starts_at) constraint means re running never duplicates. each
// session is inserted in its own transaction so one conflict does not abort the batch

import { isExclusionViolation, pool, withTransaction } from '../../db';
import { addDays, addMinutes, todayIn, toInstant, weekdayOf } from '../../lib/time';
import * as repo from './repository';
import { CourseRow, GenerationReport } from './types';

export const generateForCourse = async (orgId: string, course: CourseRow, actorId: string | null): Promise<GenerationReport> => {
  const report: GenerationReport = { courseId: course.id, created: 0, skippedClosure: 0, skippedConflict: [] };
  if (course.status !== 'open') return report;

  const [zone, settings, slots] = await Promise.all([repo.orgTimezone(pool, orgId), repo.orgSettings(pool, orgId), repo.listSlots(pool, course.id)]);
  const today = todayIn(zone);
  const horizonEnd = addDays(today, settings.session_horizon_weeks * 7);
  const windowStart = course.starts_on > today ? course.starts_on : today;
  const windowEnd = course.ends_on && course.ends_on < horizonEnd ? course.ends_on : horizonEnd;
  if (windowStart > windowEnd) return report;

  const closed = await repo.closureDates(pool, orgId, course.branch_id, windowStart, windowEnd);

  for (const slot of slots) {
    // resume after the last generated session for this slot so reruns are cheap
    const last = await repo.latestSessionDate(pool, course.id, slot.id, zone);
    let d = last && addDays(last, 1) > windowStart ? addDays(last, 1) : windowStart;

    while (d <= windowEnd) {
      if (weekdayOf(d) === slot.weekday) {
        if (closed.has(d)) {
          report.skippedClosure++;
        } else {
          const startsAt = toInstant(d, slot.start_time, zone);
          const endsAt = addMinutes(startsAt, slot.duration_minutes);
          try {
            const row = await withTransaction(tx => repo.insertSession(tx, orgId, {
              course_id: course.id, slot_id: slot.id, starts_at: startsAt, ends_at: endsAt,
              tutor_id: course.default_tutor_id, classroom_id: course.default_classroom_id, is_adhoc: false, created_by: actorId,
            }));
            if (row) report.created++;
          } catch (err) {
            if (isExclusionViolation(err, 'sessions_no_tutor_overlap')) report.skippedConflict.push({ startsAt: startsAt.toISOString(), reason: 'tutor already booked' });
            else if (isExclusionViolation(err, 'sessions_no_classroom_overlap')) report.skippedConflict.push({ startsAt: startsAt.toISOString(), reason: 'classroom already booked' });
            else throw err;
          }
        }
      }
      d = addDays(d, 1);
    }
  }
  return report;
};

export const generateForAllOpenCourses = async (orgId: string): Promise<GenerationReport[]> => {
  const courses = await repo.listCourses(pool, orgId, { status: 'open' });
  const reports: GenerationReport[] = [];
  for (const c of courses) reports.push(await generateForCourse(orgId, c, null));
  return reports;
};