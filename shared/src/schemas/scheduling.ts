// shared/src/schemas/scheduling.ts

import { z } from 'zod';
import { COURSE_STATUSES, LEAVE_STATUSES, LEAVE_TYPES, SESSION_STATUSES } from '../enums';
import { isoDate, timeOfDay, uuid, weekday } from '../primitives';

export const slotSchema = z.object({
  weekday,
  start_time: timeOfDay,
  duration_minutes: z.number().int().min(15).max(480),
});
export type SlotInput = z.infer<typeof slotSchema>;

// shape first, derive, then refine. zod 4 refuses .partial() on a schema that already
// carries a refinement, so the plain object has to exist separately
const termFields = z.object({
  name: z.string().trim().min(1).max(50),
  starts_on: isoDate,
  ends_on: isoDate,
});
const datesOrdered = (t: { starts_on?: string; ends_on?: string }) =>
  !t.starts_on || !t.ends_on || t.ends_on >= t.starts_on;
const dateOrderIssue = { path: ['ends_on'], message: 'ends_on must not be before starts_on' };

export const createTermSchema = termFields.refine(datesOrdered, dateOrderIssue);
export const updateTermSchema = termFields.partial()
  .refine(o => Object.keys(o).length > 0, 'No fields to update')
  .refine(datesOrdered, dateOrderIssue);
export type CreateTermInput = z.infer<typeof createTermSchema>;
export type UpdateTermInput = z.infer<typeof updateTermSchema>;

export const createCourseSchema = z.object({
  branch_id: uuid,
  subject_id: uuid,
  level_id: uuid.nullable().default(null),
  term_id: uuid.nullable().default(null),
  fee_plan_id: uuid.nullable().default(null),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable().default(null),
  default_tutor_id: uuid.nullable().default(null),
  default_classroom_id: uuid.nullable().default(null),
  capacity: z.number().int().min(1).max(500),
  starts_on: isoDate,
  ends_on: isoDate.nullable().default(null),
  slots: z.array(slotSchema).min(1).max(7),
}).refine(c => !c.ends_on || c.ends_on >= c.starts_on, dateOrderIssue);
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  level_id: uuid.nullable(),
  term_id: uuid.nullable(),
  fee_plan_id: uuid.nullable(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable(),
  default_tutor_id: uuid.nullable(),
  default_classroom_id: uuid.nullable(),
  capacity: z.number().int().min(1).max(500),
  ends_on: isoDate.nullable(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const courseStatusSchema = z.object({ status: z.enum(['open', 'closed', 'archived']) });

export const listCoursesQuery = z.object({
  branchId: uuid.optional(),
  subjectId: uuid.optional(),
  levelId: uuid.optional(),
  tutorId: uuid.optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  // parents only: restrict to courses one child could join
  studentId: uuid.optional(),
});

// one request should not be able to scan a year of sessions. 92 days covers a full term,
// which is the widest view any screen needs
const MAX_RANGE_DAYS = 92;
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

export const listSessionsQuery = z.object({
  from: isoDate,
  to: isoDate,
  courseId: uuid.optional(),
  branchId: uuid.optional(),
  tutorId: uuid.optional(),
  classroomId: uuid.optional(),
  status: z.enum(SESSION_STATUSES).optional(),
})
  .refine(q => q.to >= q.from, { path: ['to'], message: 'to must not be before from' })
  .refine(q => daysBetween(q.from, q.to) <= MAX_RANGE_DAYS, { path: ['to'], message: `Range must not exceed ${MAX_RANGE_DAYS} days` });

export const createAdhocSessionSchema = z.object({
  course_id: uuid,
  date: isoDate,
  start_time: timeOfDay,
  duration_minutes: z.number().int().min(15).max(480),
  tutor_id: uuid.nullable().default(null),
  classroom_id: uuid.nullable().default(null),
});
export type CreateAdhocSessionInput = z.infer<typeof createAdhocSessionSchema>;

export const rescheduleSessionSchema = z.object({
  date: isoDate.optional(),
  start_time: timeOfDay.optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  classroom_id: uuid.nullable().optional(),
  tutor_id: uuid.nullable().optional(),
}).refine(o => Object.keys(o).length > 0, 'No fields to update');
export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;

export const cancelSessionSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const sessionNotesSchema = z.object({
  lesson_notes: z.string().trim().max(5000).nullable().optional(),
  homework: z.string().trim().max(5000).nullable().optional(),
});
export const assignCoverSchema = z.object({ tutor_id: uuid });

export const availabilitySchema = z.object({
  slots: z.array(
    z.object({ weekday, start_time: timeOfDay, end_time: timeOfDay })
      .refine(s => s.end_time > s.start_time, 'end_time must be after start_time'),
  ).max(21),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const createLeaveSchema = z.object({
  starts_on: isoDate,
  ends_on: isoDate,
  leave_type: z.enum(LEAVE_TYPES),
  reason: z.string().trim().max(500).optional(),
}).refine(datesOrdered, dateOrderIssue);
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;

export const decideLeaveSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

export const listLeaveQuery = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
  userId: uuid.optional(),
});