// backend/src/modules/enrollment/schemas.ts

import { z } from 'zod';
import { isoDate, uuid } from '../../http/middleware/validate';

export const enrollSchema = z.object({ studentId: uuid, courseId: uuid, startsOn: isoDate.optional() });
export const withdrawSchema = z.object({ effectiveOn: isoDate.optional(), reason: z.string().trim().max(500).optional() });
export const listEnrollmentsQuery = z.object({
  studentId: uuid.optional(), courseId: uuid.optional(),
  status: z.enum(['active', 'withdrawn', 'completed']).optional(),
});

export const joinWaitlistSchema = z.object({ studentId: uuid, courseId: uuid });
export const listWaitlistQuery = z.object({ courseId: uuid.optional(), studentId: uuid.optional() });

export const sessionParam = z.object({ sessionId: uuid });
export const markAttendanceSchema = z.object({
  records: z.array(z.object({
    studentId: uuid,
    status: z.enum(['present', 'absent', 'late', 'excused']),
    notes: z.string().trim().max(500).nullable().default(null),
  })).min(1).max(200),
});

export const listMakeupsQuery = z.object({ studentId: uuid.optional(), status: z.enum(['available', 'booked', 'used', 'expired', 'forfeited']).optional() });
export const bookMakeupSchema = z.object({ sessionId: uuid });