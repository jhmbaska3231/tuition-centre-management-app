// backend/src/modules/notifications/repository.ts

import { Queryable, execute, many } from '../../db';
import { ClaimedNotification, NotificationRow, PreferenceRow } from './types';

// lease based claim: bump attempts and push scheduled_for out by the lease so another
// worker will not pick the same rows. skip locked makes concurrent claims safe
export const claimBatch = (q: Queryable, limit: number, leaseSeconds: number) =>
  many<ClaimedNotification>(q,
    `WITH picked AS (
       SELECT id FROM notifications
       WHERE status = 'pending' AND scheduled_for <= now()
       ORDER BY scheduled_for LIMIT $1 FOR UPDATE SKIP LOCKED),
     leased AS (
       UPDATE notifications n SET attempts = n.attempts + 1, scheduled_for = now() + make_interval(secs => $2)
       FROM picked WHERE n.id = picked.id RETURNING n.*)
     SELECT l.*, u.email AS recipient_email, u.first_name AS recipient_first_name, u.last_name AS recipient_last_name, u.archived_at AS recipient_archived_at,
            o.name AS org_name, o.timezone AS org_timezone, o.currency AS org_currency,
            (SELECT p.enabled FROM notification_preferences p WHERE p.user_id = l.recipient_user_id AND p.channel = l.channel AND p.event_key = l.event_key) AS pref_enabled
     FROM leased l JOIN users u ON u.id = l.recipient_user_id JOIN organisations o ON o.id = l.org_id`,
    [limit, leaseSeconds]);

// sent: scrub the payload so secrets like reset tokens do not linger
export const markSent = (q: Queryable, id: string) =>
  execute(q, `UPDATE notifications SET status = 'sent', sent_at = now(), last_error = NULL, payload = '{}'::jsonb WHERE id = $1`, [id]);

export const markCancelled = (q: Queryable, id: string, reason: string) =>
  execute(q, `UPDATE notifications SET status = 'cancelled', last_error = $2, payload = '{}'::jsonb WHERE id = $1`, [id, reason]);

export const markRetry = (q: Queryable, id: string, error: string, delaySeconds: number) =>
  execute(q, `UPDATE notifications SET status = 'pending', last_error = $2, scheduled_for = now() + make_interval(secs => $3) WHERE id = $1`, [id, error, delaySeconds]);

export const markFailed = (q: Queryable, id: string, error: string) =>
  execute(q, `UPDATE notifications SET status = 'failed', last_error = $2 WHERE id = $1`, [id, error]);

export const listPreferences = (q: Queryable, userId: string) =>
  many<PreferenceRow>(q, 'SELECT channel, event_key, enabled FROM notification_preferences WHERE user_id = $1 ORDER BY event_key', [userId]);

// org level toggles. an event with no row is on, matching iseventenabled in outbox.ts
export const listEventSettings = (q: Queryable, orgId: string) =>
  many<{ event_key: string; enabled: boolean }>(q,
    'SELECT event_key, enabled FROM notification_event_settings WHERE org_id = $1', [orgId]);

export const upsertPreference = (q: Queryable, userId: string, channel: string, eventKey: string, enabled: boolean) =>
  execute(q,
    `INSERT INTO notification_preferences (user_id, channel, event_key, enabled) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, channel, event_key) DO UPDATE SET enabled = EXCLUDED.enabled`, [userId, channel, eventKey, enabled]);

export const listOutbox = (q: Queryable, orgId: string, f: { status?: string; recipientUserId?: string; limit: number; offset: number }) =>
  many<NotificationRow & { recipient_email: string }>(q,
    `SELECT n.*, u.email AS recipient_email FROM notifications n JOIN users u ON u.id = n.recipient_user_id
     WHERE n.org_id = $1 AND ($2::text IS NULL OR n.status = $2) AND ($3::uuid IS NULL OR n.recipient_user_id = $3)
     ORDER BY n.created_at DESC LIMIT $4 OFFSET $5`, [orgId, f.status ?? null, f.recipientUserId ?? null, f.limit, f.offset]);

export const requeueFailed = (q: Queryable, orgId: string, id: string) =>
  execute(q, `UPDATE notifications SET status = 'pending', attempts = 0, scheduled_for = now() WHERE org_id = $1 AND id = $2 AND status = 'failed'`, [orgId, id]);

// sessions starting 24 to 25 hours from now, with each roster student and their guardians
export const upcomingSessionRecipients = (q: Queryable, orgId: string) =>
  many<{ session_id: string; user_id: string; student_name: string; course_name: string; branch_name: string; classroom_name: string | null; starts_at: Date }>(q,
    `WITH s AS (
       SELECT s.id, s.course_id, s.starts_at, c.name AS course_name, b.name AS branch_name, cr.name AS classroom_name, (s.starts_at AT TIME ZONE o.timezone)::date AS d
       FROM sessions s JOIN organisations o ON o.id = s.org_id JOIN courses c ON c.id = s.course_id JOIN branches b ON b.id = c.branch_id
       LEFT JOIN classrooms cr ON cr.id = s.classroom_id
       WHERE s.org_id = $1 AND s.status = 'scheduled' AND s.starts_at BETWEEN now() + interval '24 hours' AND now() + interval '25 hours'),
     members AS (
       SELECT s.id AS session_id, e.student_id FROM s JOIN enrollments e ON e.course_id = s.course_id AND e.status = 'active' AND e.starts_on <= s.d AND (e.ends_on IS NULL OR e.ends_on >= s.d)
       UNION SELECT s.id, mb.student_id FROM s JOIN makeup_bookings mb ON mb.booked_session_id = s.id AND mb.status = 'booked')
     SELECT m.session_id, sg.user_id, st.first_name || ' ' || st.last_name AS student_name, s.course_name, s.branch_name, s.classroom_name, s.starts_at
     FROM members m JOIN s ON s.id = m.session_id JOIN students st ON st.id = m.student_id AND st.archived_at IS NULL
     JOIN student_guardians sg ON sg.student_id = m.student_id AND sg.receives_notifications
     JOIN users u ON u.id = sg.user_id AND u.archived_at IS NULL`, [orgId]);