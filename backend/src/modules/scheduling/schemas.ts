// backend/src/modules/scheduling/schemas.ts

import { z } from 'zod';
import { isoDate, uuid } from '../../http/middleware/validate';

const time = z.iso.time({ precision: -1 });
const weekday = z.number().int().min(0).max(6);
const termFields = z.object({ name: z.string().trim().min(1).max(50), starts_on: isoDate, ends_on: isoDate });
const orderedDates = (t: { starts_on?: string; ends_on?: string }) => !t.starts_on || !t.ends_on || t.ends_on >= t.starts_on;

export const slotSchema = z.object({ weekday, start_time: time, duration_minutes: z.number().int().min(15).max(480) });

export const createTermSchema = termFields.refine(orderedDates, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });
export const updateTermSchema = termFields.partial()
  .refine(o => Object.keys(o).length > 0, 'No fields to update')
  .refine(orderedDates, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });

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
}).refine(c => !c.ends_on || c.ends_on >= c.starts_on, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });

export const updateCourseSchema = z.object({
  level_id: uuid.nullable(), term_id: uuid.nullable(), fee_plan_id: uuid.nullable(),
  name: z.string().trim().min(1).max(100), description: z.string().trim().max(2000).nullable(),
  default_tutor_id: uuid.nullable(), default_classroom_id: uuid.nullable(),
  capacity: z.number().int().min(1).max(500), ends_on: isoDate.nullable(),
}).partial().refine(o => Object.keys(o).length > 0, 'No fields to update');

export const courseStatusSchema = z.object({ status: z.enum(['open', 'closed', 'archived']) });

export const listCoursesQuery = z.object({
  branchId: uuid.optional(), subjectId: uuid.optional(), levelId: uuid.optional(), tutorId: uuid.optional(),
  status: z.enum(['draft', 'open', 'closed', 'archived']).optional(),
  studentId: uuid.optional(),          // parents: filter to courses one child can join
});

export const listSessionsQuery = z.object({
  from: isoDate, to: isoDate,
  courseId: uuid.optional(), branchId: uuid.optional(), tutorId: uuid.optional(), classroomId: uuid.optional(),
  status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
}).refine(q => q.to >= q.from, { path: ['to'], message: 'to must not be before from' });

export const createAdhocSessionSchema = z.object({
  course_id: uuid, date: isoDate, start_time: time, duration_minutes: z.number().int().min(15).max(480),
  tutor_id: uuid.nullable().default(null), classroom_id: uuid.nullable().default(null),
});

export const rescheduleSessionSchema = z.object({
  date: isoDate.optional(), start_time: time.optional(), duration_minutes: z.number().int().min(15).max(480).optional(),
  classroom_id: uuid.nullable().optional(), tutor_id: uuid.nullable().optional(),
}).refine(o => Object.keys(o).length > 0, 'No fields to update');

export const cancelSessionSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const sessionNotesSchema = z.object({ lesson_notes: z.string().trim().max(5000).nullable().optional(), homework: z.string().trim().max(5000).nullable().optional() });
export const assignCoverSchema = z.object({ tutor_id: uuid });

export const availabilitySchema = z.object({
  slots: z.array(z.object({ weekday, start_time: time, end_time: time }).refine(s => s.end_time > s.start_time, 'end_time must be after start_time')).max(21),
});

export const createLeaveSchema = z.object({
  starts_on: isoDate, ends_on: isoDate, leave_type: z.enum(['annual', 'medical', 'other']), reason: z.string().trim().max(500).optional(),
}).refine(l => l.ends_on >= l.starts_on, { path: ['ends_on'], message: 'ends_on must not be before starts_on' });
export const decideLeaveSchema = z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional() });
export const listLeaveQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(), userId: uuid.optional() });