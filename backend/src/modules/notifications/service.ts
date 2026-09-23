// backend/src/modules/notifications/service.ts

import { pool, withTransaction } from '../../db';
import { ForbiddenError, NotFoundError } from '../../http/errors';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { emailProviderFor, invalidateEmailProvider } from './providers/email';
import * as repo from './repository';
import type { NotificationChannel, NotificationEvent, NotificationPreference } from '@tuition/shared';

// events each role can actually receive, and therefore control. password_reset and
// account_created are deliberately absent: they are transactional, always on, and have no
// row in notification_event_settings. keep this in sync with the enqueue call sites, since
// an event that is never sent to a role should not appear on that role's screen
const EVENTS_BY_ROLE: Record<AuthUser['role'], NotificationEvent[]> = {
  parent: ['session_reminder', 'session_cancelled', 'session_rescheduled', 'tutor_changed', 'student_absent', 'invoice_issued', 'invoice_overdue', 'waitlist_offer'],
  tutor: ['session_cancelled', 'session_rescheduled', 'leave_request_decided'],
  branch_manager: ['leave_request_submitted'],
  admin: ['leave_request_submitted'],
};

// the full matrix the account screen renders: one row per controllable event, with the
// user's choice and the centre's setting already resolved. only email today, since the
// dispatcher cancels sms and whatsapp
export const listMyPreferences = async (user: AuthUser): Promise<NotificationPreference[]> => {
  const [prefs, events] = await Promise.all([
    repo.listPreferences(pool, user.id),
    repo.listEventSettings(pool, user.orgId),
  ]);
  const orgOff = new Set(events.filter(e => !e.enabled).map(e => e.event_key));
  const mine = new Map(prefs.filter(p => p.channel === 'email').map(p => [p.event_key, p.enabled]));
  return EVENTS_BY_ROLE[user.role].map(event_key => ({
    channel: 'email' as const,
    event_key,
    // no stored row means on, matching the dispatcher's treatment of a null preference
    enabled: mine.get(event_key) ?? true,
    org_enabled: !orgOff.has(event_key),
  }));
};

// one upsert needs no transaction. returns the full matrix so the account screen can
// replace its cache with the response rather than patching a single row
export const setMyPreference = async (user: AuthUser, channel: NotificationChannel, eventKey: NotificationEvent, enabled: boolean) => {
  await repo.upsertPreference(pool, user.id, channel, eventKey, enabled);
  return listMyPreferences(user);
};

// admin: confirm the configured provider actually delivers
export const sendTestEmail = async (user: AuthUser) => {
  if (user.role !== 'admin') throw new ForbiddenError();
  invalidateEmailProvider(user.orgId);
  const provider = await emailProviderFor(user.orgId);
  const result = await provider.send({ to: user.email, toName: `${user.firstName} ${user.lastName}`, subject: 'Test email', text: 'Your email integration is working.', html: '<p>Your email integration is working.</p>' });
  await withTransaction(tx => writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'notifications.test_sent', entityType: 'org_integration', entityId: null, after: { provider: provider.name } }));
  return { provider: provider.name, providerMessageId: result.providerMessageId };
};

export const listOutbox = (user: AuthUser, f: { status?: string; recipientUserId?: string; limit: number; offset: number }) => {
  if (user.role !== 'admin') throw new ForbiddenError();
  return repo.listOutbox(pool, user.orgId, f);
};

export const requeue = (user: AuthUser, id: string) =>
  withTransaction(async tx => {
    if (user.role !== 'admin') throw new ForbiddenError();
    if ((await repo.requeueFailed(tx, user.orgId, id)) === 0) throw new NotFoundError('Failed notification');
    await writeAudit(tx, { orgId: user.orgId, actorUserId: user.id, action: 'notifications.requeued', entityType: 'notification', entityId: id });
  });