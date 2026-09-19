// backend/src/modules/notifications/outbox.ts
//
// writes to the notifications table inside the caller's transaction. honors the
// org level event toggle and each guardian's receives_notifications flag. the
// dispatcher that actually sends is in the notifications module proper (next)

import { Queryable, execute, many, maybeOne } from '../../db';

export interface OutboxMessage {
  orgId: string;
  recipientUserId: string;
  eventKey: string;
  template: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  scheduledFor?: Date;
}

const isEventEnabled = async (q: Queryable, orgId: string, eventKey: string): Promise<boolean> => {
  const row = await maybeOne<{ enabled: boolean }>(q,
    'SELECT enabled FROM notification_event_settings WHERE org_id = $1 AND event_key = $2', [orgId, eventKey]);
  // events not listed in settings (password_reset, account_created) are always on
  return row ? row.enabled : true;
};

export const enqueue = async (q: Queryable, m: OutboxMessage): Promise<number> => {
  if (!(await isEventEnabled(q, m.orgId, m.eventKey))) return 0;
  return execute(q,
    `INSERT INTO notifications (org_id, recipient_user_id, channel, event_key, template, payload, dedupe_key, scheduled_for)
     VALUES ($1, $2, 'email', $3, $4, $5, $6, COALESCE($7, now()))
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [m.orgId, m.recipientUserId, m.eventKey, m.template, JSON.stringify(m.payload), m.dedupeKey ?? null, m.scheduledFor ?? null]);
};

// guardians of every student on a session's roster (active enrollments covering the
// session date, plus make-up bookings), deduplicated
export const enqueueForSessionGuardians = async (
  q: Queryable, orgId: string, sessionId: string, eventKey: string, template: string, payload: Record<string, unknown>,
): Promise<number> => {
  if (!(await isEventEnabled(q, orgId, eventKey))) return 0;
  const recipients = await many<{ user_id: string }>(q,
    `SELECT DISTINCT sg.user_id
     FROM sessions s
     JOIN organisations o ON o.id = s.org_id
     JOIN enrollments e ON e.course_id = s.course_id AND e.status = 'active'
       AND e.starts_on <= (s.starts_at AT TIME ZONE o.timezone)::date
       AND (e.ends_on IS NULL OR e.ends_on >= (s.starts_at AT TIME ZONE o.timezone)::date)
     JOIN student_guardians sg ON sg.student_id = e.student_id AND sg.receives_notifications
     JOIN users u ON u.id = sg.user_id AND u.archived_at IS NULL
     WHERE s.id = $1
     UNION
     SELECT DISTINCT sg.user_id
     FROM makeup_bookings mb
     JOIN student_guardians sg ON sg.student_id = mb.student_id AND sg.receives_notifications
     JOIN users u ON u.id = sg.user_id AND u.archived_at IS NULL
     WHERE mb.booked_session_id = $1 AND mb.status = 'booked'`,
    [sessionId]);
  for (const r of recipients) {
    await enqueue(q, { orgId, recipientUserId: r.user_id, eventKey, template, payload, dedupeKey: `${eventKey}:${sessionId}:${r.user_id}` });
  }
  return recipients.length;
};

export const enqueueForRole = async (q: Queryable, orgId: string, roles: string[], eventKey: string, template: string, payload: Record<string, unknown>, dedupePrefix: string) => {
  if (!(await isEventEnabled(q, orgId, eventKey))) return;
  const recipients = await many<{ id: string }>(q,
    'SELECT id FROM users WHERE org_id = $1 AND role = ANY($2) AND archived_at IS NULL', [orgId, roles]);
  for (const r of recipients) {
    await enqueue(q, { orgId, recipientUserId: r.id, eventKey, template, payload, dedupeKey: `${dedupePrefix}:${r.id}` });
  }
};