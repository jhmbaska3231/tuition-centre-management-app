// shared/src/schemas/enrollment.ts

import { z } from 'zod';
import { ATTENDANCE_STATUSES, ENROLLMENT_STATUSES, MAKEUP_STATUSES } from '../enums';
import { isoDate, uuid } from '../primitives';

export const enrollSchema = z.object({
  studentId: uuid,
  courseId: uuid,
  startsOn: isoDate.optional(),
});
export type EnrollInput = z.infer<typeof enrollSchema>;

// effectiveon is staff only. omitted, the service defaults to the end of the current
// billing period so the invoice and the roster stay consistent
export const withdrawSchema = z.object({
  effectiveOn: isoDate.optional(),
  reason: z.string().trim().max(500).optional(),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;

export const listEnrollmentsQuery = z.object({
  studentId: uuid.optional(),
  courseId: uuid.optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
});

export const joinWaitlistSchema = z.object({ studentId: uuid, courseId: uuid });
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;

export const listWaitlistQuery = z.object({
  courseId: uuid.optional(),
  studentId: uuid.optional(),
});

export const sessionParam = z.object({ sessionId: uuid });

// the roster is derived server side, any studentid not on it is rejected
export const markAttendanceSchema = z.object({
  records: z.array(z.object({
    studentId: uuid,
    status: z.enum(ATTENDANCE_STATUSES),
    notes: z.string().trim().max(500).nullable().default(null),
  })).min(1).max(200),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const listMakeupsQuery = z.object({
  studentId: uuid.optional(),
  status: z.enum(MAKEUP_STATUSES).optional(),
});

export const bookMakeupSchema = z.object({ sessionId: uuid });
export type BookMakeupInput = z.infer<typeof bookMakeupSchema>;