// backend/src/modules/notifications/service.ts

import { pool, withTransaction } from '../../db';
import { ForbiddenError, NotFoundError } from '../../http/errors';
import { writeAudit } from '../audit/writer';
import { AuthUser } from '../auth/types';
import { emailProviderFor, invalidateEmailProvider } from './providers/email';
import * as repo from './repository';

export const listMyPreferences = (user: AuthUser) => repo.listPreferences(pool, user.id);

export const setMyPreference = (user: AuthUser, channel: string, eventKey: string, enabled: boolean) =>
  withTransaction(async tx => {
    await repo.upsertPreference(tx, user.id, channel, eventKey, enabled);
    return repo.listPreferences(tx, user.id);
  });

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