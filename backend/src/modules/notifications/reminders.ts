// backend/src/modules/notifications/reminders.ts
//
// hourly. enqueues a reminder for every guardian of every student on sessions starting
// in 24 to 25 hours. the dedupe key makes hourly re runs and overlapping windows harmless

import { pool, withTransaction } from '../../db';
import { enqueue } from './outbox';
import * as repo from './repository';

export const enqueueSessionReminders = async (orgId: string): Promise<number> => {
  const rows = await repo.upcomingSessionRecipients(pool, orgId);
  await withTransaction(async tx => {
    for (const r of rows) {
      await enqueue(tx, {
        orgId, recipientUserId: r.user_id, eventKey: 'session_reminder', template: 'session_reminder_v1',
        payload: { sessionId: r.session_id, studentName: r.student_name, courseName: r.course_name, branchName: r.branch_name, classroomName: r.classroom_name, startsAt: r.starts_at },
        dedupeKey: `session_reminder:${r.session_id}:${r.user_id}:${r.student_name}`,
      });
    }
  });
  return rows.length;
};